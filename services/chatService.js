import prisma from "../config/prismaClient.js";
import sanitizeData from "../utils/sanitizeHtml.js";
import ChatValidationService from "./chatValidationService.js";

const USER_SELECT_WITH_PROFILES = {
    id: true,
    name: true,
    username: true,
    profile: true,
    role: true,
    city: true,
    state: true,
    country: true,
    architect: true,
    designer: true,
    contractor: true,
};

const safeJsonArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export function formatParticipantUser(rawUser) {
    if (!rawUser) return null;

    const role = rawUser.role;
    let profileImageUrl = null;

    // Check if rawUser.profile is a valid image URL/path
    if (typeof rawUser.profile === "string" && rawUser.profile.trim() !== "") {
        const trimmed = rawUser.profile.trim();
        if (
            trimmed.startsWith("http://") ||
            trimmed.startsWith("https://") ||
            trimmed.startsWith("/uploads") ||
            trimmed.startsWith("data:") ||
            trimmed.startsWith("blob:")
        ) {
            profileImageUrl = trimmed;
        }
    }

    let profileObj = null;

    if (role === 3) {
        // ARCHITECT Schema
        const arch = rawUser.architect;
        if (arch) {
            profileObj = {
                bio: arch.bio || "",
                specialization: safeJsonArray(arch.specializations).join(", ") || "",
                specializations: safeJsonArray(arch.specializations),
                experience: arch.yearsOfExperience ?? 0,
                yearsOfExperience: arch.yearsOfExperience ?? 0,
                experienceLevel: arch.experienceLevel || "INTERMEDIATE",
                licenseNumber: arch.licenseNumber || "",
                licenseIssuingBody: arch.licenseIssuingBody || "",
                rating: arch.rating ?? 0,
                totalReviews: arch.totalReviews ?? 0,
                serviceCities: safeJsonArray(arch.serviceCities),
                portfolioLinks: safeJsonArray(arch.portfolioLinks),
            };
        }
    } else if (role === 2) {
        // DESIGNER Schema
        const des = rawUser.designer;
        if (des) {
            profileObj = {
                bio: des.bio || "",
                specialization: Array.isArray(des.specializations) ? des.specializations.join(", ") : "",
                specializations: Array.isArray(des.specializations) ? des.specializations : [],
                designStyles: Array.isArray(des.designStyles) ? des.designStyles : [],
                experience: des.yearsOfExperience ?? 0,
                yearsOfExperience: des.yearsOfExperience ?? 0,
                experienceLevel: des.experienceLevel || "INTERMEDIATE",
                rating: des.rating ?? 0,
                totalReviews: des.totalReviews ?? 0,
                serviceCities: Array.isArray(des.serviceCities) ? des.serviceCities : [],
                portfolioLinks: Array.isArray(des.portfolioLinks) ? des.portfolioLinks : [],
            };
            if (!profileImageUrl && Array.isArray(des.photos) && des.photos.length > 0) {
                profileImageUrl = des.photos[0];
            }
        }
    } else if (role === 4) {
        // CONTRACTOR Schema
        const con = rawUser.contractor;
        if (con) {
            profileObj = {
                bio: con.bio || "",
                specialization: safeJsonArray(con.workTypes).join(", ") || "",
                workTypes: safeJsonArray(con.workTypes),
                experience: con.yearsOfExperience ?? 0,
                yearsOfExperience: con.yearsOfExperience ?? 0,
                experienceLevel: con.experienceLevel || "INTERMEDIATE",
                teamSize: con.teamSize ?? null,
                licenseNumber: con.licenseNumber || "",
                rating: con.rating ?? 0,
                totalReviews: con.totalReviews ?? 0,
                serviceCities: safeJsonArray(con.serviceCities),
                portfolioLinks: safeJsonArray(con.portfolioLinks),
            };
        }
    } else if (role === 1) {
        // CLIENT
        profileObj = {
            city: rawUser.city || "",
            state: rawUser.state || "",
            country: rawUser.country || "",
        };
    }

    return {
        id: rawUser.id,
        name: rawUser.name,
        username: rawUser.username || null,
        role: rawUser.role,
        profileImageUrl: profileImageUrl || null,
        profile: profileObj,
    };
}

export function formatChatResponse(chat) {
    if (!chat) return null;
    return {
        ...chat,
        participants: (chat.participants || []).map((p) => ({
            ...p,
            user: formatParticipantUser(p.user),
        })),
        messages: (chat.messages || []).map((m) => ({
            ...m,
            sender: formatParticipantUser(m.sender),
        })),
    };
}

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
                AND: [
                    { participants: { some: { userId: clientId } } },
                    { participants: { some: { userId: professionalUserId } } },
                ],
            },
            include: {
                participants: {
                    include: {
                        user: { select: USER_SELECT_WITH_PROFILES },
                    },
                },
            },
            orderBy: { createdAt: "asc" }, // prefer oldest existing chat
        });

        if (!chat) {
            try {
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
                                user: { select: USER_SELECT_WITH_PROFILES },
                            },
                        },
                    },
                });
            } catch (createErr) {
                // If concurrent request created it simultaneously, fetch the created chat
                chat = await prisma.chat.findFirst({
                    where: {
                        projectId,
                        type: "DIRECT",
                        AND: [
                            { participants: { some: { userId: clientId } } },
                            { participants: { some: { userId: professionalUserId } } },
                        ],
                    },
                    include: {
                        participants: {
                            include: {
                                user: { select: USER_SELECT_WITH_PROFILES },
                            },
                        },
                    },
                });
                if (!chat) throw createErr;
            }
        }

        return formatChatResponse(chat);
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
                        user: { select: USER_SELECT_WITH_PROFILES },
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
                            user: { select: USER_SELECT_WITH_PROFILES },
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
                                user: { select: USER_SELECT_WITH_PROFILES },
                            },
                        },
                    },
                });
            }
        }

        return formatChatResponse(chat);
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
        // Enforce platform chat message safety & anti-disintermediation
        ChatValidationService.validateMessage(text, attachments);

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
                    select: USER_SELECT_WITH_PROFILES,
                },
            },
        });

        // Update chat updatedAt timestamp
        await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
        });

        return {
            ...message,
            sender: formatParticipantUser(message.sender),
        };
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
                        select: USER_SELECT_WITH_PROFILES,
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: parsedLimit,
            }),
            prisma.message.count({ where: { chatId } }),
        ]);

        return {
            messages: messages.reverse().map((m) => ({
                ...m,
                sender: formatParticipantUser(m.sender),
            })),
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
                        user: { select: USER_SELECT_WITH_PROFILES },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: USER_SELECT_WITH_PROFILES },
                    },
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                senderId: { not: userId },
                                isRead: false,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        // Deduplicate in case multiple historical direct chats were created
        const seen = new Set();
        const uniqueChats = [];
        for (const c of chats) {
            let key;
            if (c.type === "DIRECT") {
                const sortedParticipants = (c.participants || []).map((p) => p.userId).sort().join("_");
                key = `${c.projectId}_DIRECT_${sortedParticipants}`;
            } else {
                key = `${c.projectId}_${c.type}`;
            }

            if (!seen.has(key)) {
                seen.add(key);
                uniqueChats.push(
                    formatChatResponse({
                        ...c,
                        unreadCount: c._count?.messages || 0,
                    })
                );
            }
        }

        return uniqueChats;
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
                            select: USER_SELECT_WITH_PROFILES,
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: USER_SELECT_WITH_PROFILES },
                    },
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                senderId: { not: userId },
                                isRead: false,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        // Deduplicate in case multiple historical direct chats were created
        const seen = new Set();
        const uniqueChats = [];
        for (const c of chats) {
            let key;
            if (c.type === "DIRECT") {
                const other = (c.participants || []).find((p) => p.userId !== userId);
                const otherId = other ? other.userId : c.id;
                key = `${c.projectId}_DIRECT_${otherId}`;
            } else {
                key = `${c.projectId}_${c.type}`;
            }

            if (!seen.has(key)) {
                seen.add(key);
                uniqueChats.push(
                    formatChatResponse({
                        ...c,
                        unreadCount: c._count?.messages || 0,
                    })
                );
            }
        }

        return uniqueChats;
    }
}

export default ChatService;
