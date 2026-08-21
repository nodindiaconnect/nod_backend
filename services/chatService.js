import prisma from "../config/prismaClient.js";
import sanitizeData from "../utils/sanitizeHtml.js";

class ChatService {
    /**
     * Get or create a direct negotiation chat between Client and Professional
     */
    static async getOrCreateDirectChat(projectId, clientId, professionalUserId, bidId = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        // Find existing direct chat between these two users for this project
        let chat = await prisma.chat.findFirst({
            where: {
                projectId,
                type: "DIRECT",
                participants: {
                    every: {
                        userId: { in: [clientId, professionalUserId] },
                    },
                },
            },
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, name: true, profile: true, role: true } },
                    },
                },
            },
        });

        if (!chat) {
            chat = await prisma.chat.create({
                data: {
                    projectId,
                    type: "DIRECT",
                    bidId: bidId || undefined,
                    title: `Direct Chat: Project ${project.title}`,
                    participants: {
                        create: [
                            { userId: clientId, role: "CLIENT" },
                            { userId: professionalUserId, role: "PROFESSIONAL" },
                        ],
                    },
                },
                include: {
                    participants: {
                        include: {
                            user: { select: { id: true, name: true, profile: true, role: true } },
                        },
                    },
                },
            });
        }

        return chat;
    }

    /**
     * Get or create a project team group chat
     */
    static async getOrCreateProjectTeamChat(projectId, clientId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                teamMembers: { where: { status: "ACTIVE" } },
            },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        let chat = await prisma.chat.findFirst({
            where: {
                projectId,
                type: "PROJECT_TEAM",
            },
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, name: true, profile: true, role: true } },
                    },
                },
            },
        });

        const activeUserIds = [clientId, ...project.teamMembers.map((m) => m.userId)];

        if (!chat) {
            chat = await prisma.chat.create({
                data: {
                    projectId,
                    type: "PROJECT_TEAM",
                    title: `${project.title} - Project Team`,
                    participants: {
                        create: activeUserIds.map((uid) => ({
                            userId: uid,
                            role: uid === clientId ? "CLIENT" : "TEAM_MEMBER",
                        })),
                    },
                },
                include: {
                    participants: {
                        include: {
                            user: { select: { id: true, name: true, profile: true, role: true } },
                        },
                    },
                },
            });
        } else {
            // Synchronize any newly added team members who aren't participants yet
            const existingParticipantUserIds = new Set(chat.participants.map((p) => p.userId));
            const toAdd = activeUserIds.filter((uid) => !existingParticipantUserIds.has(uid));

            if (toAdd.length > 0) {
                await prisma.chatParticipant.createMany({
                    data: toAdd.map((uid) => ({
                        chatId: chat.id,
                        userId: uid,
                        role: uid === clientId ? "CLIENT" : "TEAM_MEMBER",
                    })),
                    skipDuplicates: true,
                });

                chat = await prisma.chat.findUnique({
                    where: { id: chat.id },
                    include: {
                        participants: {
                            include: {
                                user: { select: { id: true, name: true, profile: true, role: true } },
                            },
                        },
                    },
                });
            }
        }

        return chat;
    }

    /**
     * Verify if user is an authorized participant in the chat
     */
    static async verifyChatAccess(chatId, userId, userRole = null) {
        if (userRole === 0 || userRole === 7) return true; // Admin has oversight

        const participant = await prisma.chatParticipant.findUnique({
            where: {
                chatId_userId: { chatId, userId },
            },
        });

        return !!participant;
    }

    /**
     * Send a chat message (via REST or WebSocket)
     */
    static async sendMessage(chatId, senderId, text, attachments = []) {
        if (!text && (!attachments || attachments.length === 0)) {
            throw new Error("Message text or attachments required");
        }

        const isAuthorized = await ChatService.verifyChatAccess(chatId, senderId);
        if (!isAuthorized) {
            throw new Error("Unauthorized to post in this chat");
        }

        const sanitizedText = text ? sanitizeData(String(text).trim()) : "";
        const cleanAttachments = Array.isArray(attachments)
            ? attachments.map((a) => sanitizeData(String(a).trim())).filter(Boolean)
            : [];

        const message = await prisma.message.create({
            data: {
                chatId,
                senderId,
                text: sanitizedText,
                attachments: cleanAttachments,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        profile: true,
                        role: true,
                    },
                },
            },
        });

        // Update chat updatedAt timestamp
        await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
        });

        return message;
    }

    /**
     * Get paginated messages for a chat
     */
    static async getMessages(chatId, userId, userRole = null, { page = 1, limit = 50, beforeMessageId = null } = {}) {
        const isAuthorized = await ChatService.verifyChatAccess(chatId, userId, userRole);
        if (!isAuthorized) {
            throw new Error("Unauthorized to access messages for this chat");
        }

        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (parsedPage - 1) * parsedLimit;

        const where = { chatId };
        if (beforeMessageId) {
            const pivot = await prisma.message.findUnique({ where: { id: beforeMessageId } });
            if (pivot) {
                where.createdAt = { lt: pivot.createdAt };
            }
        }

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profile: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: parsedLimit,
            }),
            prisma.message.count({ where: { chatId } }),
        ]);

        return {
            messages: messages.reverse(), // return in chronological order
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit) || 1,
            },
        };
    }

    /**
     * Mark message(s) as read
     */
    static async markAsRead(chatId, userId, messageId = null) {
        const isAuthorized = await ChatService.verifyChatAccess(chatId, userId);
        if (!isAuthorized) {
            throw new Error("Unauthorized to access this chat");
        }

        const now = new Date();

        const updateWhere = {
            chatId,
            senderId: { not: userId },
            isRead: false,
        };

        if (messageId) {
            updateWhere.id = messageId;
        }

        const [updatedMessages] = await Promise.all([
            prisma.message.updateMany({
                where: updateWhere,
                data: {
                    isRead: true,
                    readAt: now,
                },
            }),
            prisma.chatParticipant.update({
                where: { chatId_userId: { chatId, userId } },
                data: { lastReadAt: now },
            }),
        ]);

        return { success: true, count: updatedMessages.count, readAt: now };
    }

    /**
     * Mark message as delivered
     */
    static async markAsDelivered(messageId) {
        const updated = await prisma.message.update({
            where: { id: messageId },
            data: { deliveredAt: new Date() },
        });
        return updated;
    }

    /**
     * Get chats for a specific project
     */
    static async getChatsForProject(projectId, userId, userRole = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = userRole === 0 || userRole === 7;
        const isClientOwner = project.clientId === userId;

        const where = { projectId };

        if (!isAdmin && !isClientOwner) {
            // Professionals only see chats where they are participants
            where.participants = { some: { userId } };
        }

        const chats = await prisma.chat.findMany({
            where,
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, name: true, profile: true, role: true } },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
                _count: {
                    select: { messages: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return chats;
    }

    /**
     * Get all active chats for current user across projects
     */
    static async getMyChats(userId) {
        const chats = await prisma.chat.findMany({
            where: {
                participants: { some: { userId } },
            },
            include: {
                project: {
                    select: {
                        id: true,
                        title: true,
                        category: true,
                        status: true,
                        availabilityStatus: true,
                    },
                },
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true, username: true, profile: true, role: true },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return chats;
    }
}

export default ChatService;
