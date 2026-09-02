import { Server } from "socket.io";
import { socketAuth } from "../middleware/authenticate.js";
import ChatService from "../services/chatService.js";
import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

const onlineUsers = new Map(); // userId -> Set(socketId)
let ioInstance = null;

export function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "DELETE"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    ioInstance = io;

    // Use existing socketAuth middleware
    io.use(socketAuth);

    io.on("connection", (socket) => {
        const user = socket.user;
        const userId = user.id;

        logger.info(`[Socket] User connected: ${user.name} (${userId}) - socket: ${socket.id}`);

        // Track online sockets for user
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
            io.emit("user_online", { userId, timestamp: new Date() });
        }
        onlineUsers.get(userId).add(socket.id);

        // Join user's personal notification room
        socket.join(`user:${userId}`);

        /**
         * Join project/chat room with strict authorization
         */
        socket.on("join_project", async (data, callback) => {
            try {
                const { projectId, chatId } = data || {};
                if (!chatId && !projectId) {
                    if (callback) callback({ success: false, error: "chatId or projectId is required" });
                    return;
                }

                if (chatId) {
                    const isAuthorized = await ChatService.verifyChatAccess(chatId, userId, user.role);
                    if (!isAuthorized) {
                        socket.emit("error", { message: "Unauthorized to join this chat" });
                        if (callback) callback({ success: false, error: "Unauthorized" });
                        return;
                    }

                    socket.join(`chat:${chatId}`);
                    logger.info(`[Socket] ${userId} joined chat:${chatId}`);
                }

                if (projectId) {
                    // RBAC check: verify user is project client, bidder, or team member/awardee
                    const project = await prisma.project.findUnique({
                        where: { id: projectId },
                        include: {
                            teamMembers: { where: { status: "ACTIVE" } },
                            bids: {
                                where: {
                                    OR: [
                                        { professionalId: userId },
                                        { architect: { userId } },
                                        { designer: { userId } },
                                        { contractor: { userId } },
                                    ],
                                },
                            },
                        },
                    });

                    const isAdmin = user.role === 0 || user.role === 7;
                    const isClientOwner = project && project.clientId === userId;
                    const isBidder = project && project.bids && project.bids.length > 0;
                    const isTeamMember = project && project.teamMembers && project.teamMembers.some((m) => m.userId === userId);

                    if (!isAdmin && !isClientOwner && !isBidder && !isTeamMember) {
                        logger.warn(`[Socket] Unauthorized join attempt to project:${projectId} by user ${userId}`);
                        socket.emit("error", { message: "Unauthorized to join project room" });
                        if (callback) callback({ success: false, error: "Unauthorized to join project room" });
                        return;
                    }

                    socket.join(`project:${projectId}`);
                    logger.info(`[Socket] ${userId} joined project:${projectId}`);
                }

                if (callback) callback({ success: true, message: "Joined room successfully" });
            } catch (err) {
                logger.error(`[Socket] join_project error: ${err.message}`);
                if (callback) callback({ success: false, error: err.message });
            }
        });

        /**
         * Leave project/chat room
         */
        socket.on("leave_project", (data, callback) => {
            try {
                const { projectId, chatId } = data || {};
                if (chatId) socket.leave(`chat:${chatId}`);
                if (projectId) socket.leave(`project:${projectId}`);
                if (callback) callback({ success: true, message: "Left room successfully" });
            } catch (err) {
                if (callback) callback({ success: false, error: err.message });
            }
        });

        /**
         * Send real-time message
         */
        socket.on("send_message", async (data, callback) => {
            try {
                const { chatId, text, attachments, tempId } = data || {};
                if (!chatId || (!text && (!attachments || attachments.length === 0))) {
                    if (callback) callback({ success: false, error: "chatId and text/attachments required" });
                    return;
                }

                // Persist message in database
                const message = await ChatService.sendMessage(chatId, userId, text, attachments);
                if (tempId) {
                    message.tempId = tempId;
                }

                // Broadcast to OTHER participants in the active chat room
                socket.to(`chat:${chatId}`).emit("receive_message", {
                    chatId,
                    message,
                });

                // Also notify all other participants via their personal user rooms
                const participants = await prisma.chatParticipant.findMany({
                    where: { chatId },
                    select: { userId: true },
                });

                for (const p of participants) {
                    if (p.userId !== userId) {
                        io.to(`user:${p.userId}`).emit("new_message_notification", {
                            chatId,
                            message,
                        });
                        io.to(`user:${p.userId}`).emit("receive_message", {
                            chatId,
                            message,
                        });
                        io.to(`user:${p.userId}`).emit("unread_count_update", {
                            chatId,
                            messageId: message.id,
                            type: "INCREMENT",
                        });
                    }
                }

                // Send delivery ack back to sender
                socket.emit("message_delivered", {
                    chatId,
                    messageId: message.id,
                    deliveredAt: new Date(),
                });

                if (callback) callback({ success: true, data: message });
            } catch (err) {
                logger.error(`[Socket] send_message error: ${err.message}`);
                socket.emit("error", { message: err.message });
                if (callback) callback({ success: false, error: err.message });
            }
        });

        /**
         * Mark message delivered
         */
        socket.on("message_delivered", async (data) => {
            try {
                const { messageId, chatId } = data || {};
                if (messageId) {
                    await ChatService.markAsDelivered(messageId);
                    if (chatId) {
                        io.to(`chat:${chatId}`).emit("message_delivered", {
                            messageId,
                            chatId,
                            deliveredAt: new Date(),
                        });
                    }
                }
            } catch (err) {
                logger.error(`[Socket] message_delivered error: ${err.message}`);
            }
        });

        /**
         * Mark message(s) read
         */
        socket.on("message_read", async (data, callback) => {
            try {
                const { chatId, messageId } = data || {};
                if (!chatId) return;

                const result = await ChatService.markAsRead(chatId, userId, messageId);

                // Broadcast read receipt to the chat room
                socket.to(`chat:${chatId}`).emit("message_read", {
                    chatId,
                    userId,
                    messageId,
                    readAt: result.readAt,
                });

                // Update unread count for current user
                io.to(`user:${userId}`).emit("unread_count_update", {
                    chatId,
                    type: "DECREMENT_OR_SYNC",
                });

                if (callback) callback({ success: true, data: result });
            } catch (err) {
                logger.error(`[Socket] message_read error: ${err.message}`);
                if (callback) callback({ success: false, error: err.message });
            }
        });

        /**
         * Typing indicator start
         */
        socket.on("typing_start", (data) => {
            const { chatId } = data || {};
            if (chatId) {
                socket.to(`chat:${chatId}`).emit("typing_start", {
                    chatId,
                    userId,
                    name: user.name,
                });
            }
        });

        /**
         * Typing indicator stop
         */
        socket.on("typing_stop", (data) => {
            const { chatId } = data || {};
            if (chatId) {
                socket.to(`chat:${chatId}`).emit("typing_stop", {
                    chatId,
                    userId,
                });
            }
        });

        /**
         * Disconnection
         */
        socket.on("disconnect", () => {
            logger.info(`[Socket] User disconnected: ${user.name} (${userId}) - socket: ${socket.id}`);

            if (onlineUsers.has(userId)) {
                const userSockets = onlineUsers.get(userId);
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(userId);
                    io.emit("user_offline", {
                        userId,
                        lastSeen: new Date(),
                    });
                }
            }
        });
    });

    return io;
}

/**
 * Global helper when a message is sent via REST
 */
export async function notifyNewMessage(chatId, senderId, message) {
    if (!ioInstance || !chatId) return;
    try {
        ioInstance.to(`chat:${chatId}`).emit("receive_message", {
            chatId,
            message,
        });

        const participants = await prisma.chatParticipant.findMany({
            where: { chatId },
            select: { userId: true },
        });

        for (const p of participants) {
            if (p.userId !== senderId) {
                ioInstance.to(`user:${p.userId}`).emit("new_message_notification", {
                    chatId,
                    message,
                });
                ioInstance.to(`user:${p.userId}`).emit("receive_message", {
                    chatId,
                    message,
                });
                ioInstance.to(`user:${p.userId}`).emit("unread_count_update", {
                    chatId,
                    messageId: message.id,
                    type: "INCREMENT",
                });
            }
        }
    } catch (err) {
        logger.error(`[Socket] notifyNewMessage error: ${err.message}`);
    }
}

/**
 * Global helper when messages are marked as read via REST
 */
export function notifyMessagesRead(chatId, userId) {
    if (!ioInstance || !chatId) return;
    try {
        ioInstance.to(`chat:${chatId}`).emit("message_read", {
            chatId,
            userId,
            readAt: new Date(),
        });
        ioInstance.to(`user:${userId}`).emit("unread_count_update", {
            chatId,
            userId,
            type: "DECREMENT_OR_SYNC",
        });
    } catch (err) {
        logger.error(`[Socket] notifyMessagesRead error: ${err.message}`);
    }
}

/**
 * Helper to emit event to all users subscribed to a project room
 */
export function emitToProject(projectId, eventName, payload) {
    if (ioInstance && projectId) {
        ioInstance.to(`project:${projectId}`).emit(eventName, payload);
    }
}

/**
 * Helper to emit event to a specific user
 */
export function emitToUser(userId, eventName, payload) {
    if (ioInstance && userId) {
        ioInstance.to(`user:${userId}`).emit(eventName, payload);
    }
}

