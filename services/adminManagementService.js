import prisma from "../config/prismaClient.js";
import AuditService from "./auditService.js";
import sanitizeData from "../utils/sanitizeHtml.js";

class AdminManagementService {
    /**
     * Get all bids with multidimensional filters, pagination, and sorting
     */
    static async getAllBids({
        page = 1,
        limit = 20,
        skip = 0,
        status,
        role,
        projectId,
        minAmount,
        maxAmount,
        search,
        startDate,
        endDate,
        sortBy = "createdAt",
        sortOrder = "desc",
    }) {
        const where = {};

        if (status) where.status = status;
        if (role) where.role = role;
        if (projectId) where.projectId = projectId;

        if (minAmount !== undefined || maxAmount !== undefined) {
            where.amount = {};
            if (minAmount !== undefined) where.amount.gte = Number(minAmount);
            if (maxAmount !== undefined) where.amount.lte = Number(maxAmount);
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (search) {
            where.OR = [
                { proposal: { contains: search, mode: "insensitive" } },
                { project: { title: { contains: search, mode: "insensitive" } } },
                { architect: { user: { name: { contains: search, mode: "insensitive" } } } },
                { designer: { user: { name: { contains: search, mode: "insensitive" } } } },
                { contractor: { user: { name: { contains: search, mode: "insensitive" } } } },
            ];
        }

        const allowedSortFields = ["createdAt", "amount", "status", "updatedAt"];
        const orderField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
        const orderDir = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

        const [bids, total] = await Promise.all([
            prisma.bid.findMany({
                where,
                include: {
                    project: {
                        select: {
                            id: true,
                            title: true,
                            category: true,
                            status: true,
                            city: true,
                            state: true,
                            client: { select: { id: true, name: true, email: true } },
                        },
                    },
                    architect: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
                    designer: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
                    contractor: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
                    projectTeam: true,
                },
                orderBy: { [orderField]: orderDir },
                skip,
                take: limit,
            }),
            prisma.bid.count({ where }),
        ]);

        return {
            bids,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Get single bid with complete relational context for admin
     */
    static async getBidDetailsAdmin(bidId) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: {
                    include: {
                        client: { select: { id: true, name: true, email: true, phone: true, city: true } },
                        teamMembers: { include: { user: { select: { id: true, name: true, email: true } } } },
                    },
                },
                architect: { include: { user: true } },
                designer: { include: { user: true } },
                contractor: { include: { user: true } },
                projectTeam: true,
            },
        });

        if (!bid) throw new Error("Bid not found");
        return bid;
    }

    /**
     * Admin override bid status
     */
    static async adminUpdateBidStatus(adminUser, bidId, { status, reason }, req = null) {
        const bid = await prisma.bid.findUnique({ where: { id: bidId } });
        if (!bid) throw new Error("Bid not found");

        const updated = await prisma.bid.update({
            where: { id: bidId },
            data: {
                status,
                rejectionReason: reason ? sanitizeData(reason) : bid.rejectionReason,
            },
        });

        await AuditService.logAction({
            adminId: adminUser.id,
            action: "ADMIN_UPDATE_BID_STATUS",
            entityType: "BID",
            entityId: bidId,
            details: { previousStatus: bid.status, newStatus: status, reason },
            req,
        });

        return updated;
    }

    /**
     * Admin delete / archive bid
     */
    static async deleteBidAdmin(adminUser, bidId, req = null) {
        const bid = await prisma.bid.findUnique({ where: { id: bidId } });
        if (!bid) throw new Error("Bid not found");

        await prisma.bid.delete({ where: { id: bidId } });

        await AuditService.logAction({
            adminId: adminUser.id,
            action: "ADMIN_DELETE_BID",
            entityType: "BID",
            entityId: bidId,
            details: { deletedBid: bid },
            req,
        });

        return { success: true, message: "Bid deleted successfully" };
    }

    /**
     * Get all project teams across the system
     */
    static async getProjectTeamsAdmin({ page = 1, limit = 20, skip = 0, projectId, role, status }) {
        const where = {};
        if (projectId) where.projectId = projectId;
        if (role) where.role = role;
        if (status) where.status = status;

        const [teams, total] = await Promise.all([
            prisma.projectTeam.findMany({
                where,
                include: {
                    project: {
                        select: { id: true, title: true, category: true, status: true, client: { select: { id: true, name: true, email: true } } },
                    },
                    user: {
                        select: { id: true, name: true, email: true, phone: true, role: true, profile: true },
                    },
                    bid: true,
                },
                orderBy: { joinedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.projectTeam.count({ where }),
        ]);

        return {
            teams,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Admin assign team member
     */
    static async adminAssignTeamMember(adminUser, projectId, { userId, role, bidId }, req = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: { where: { status: "ACTIVE" } } },
        });

        if (!project) throw new Error("Project not found");

        const existingMember = project.teamMembers.find((m) => m.role === role);
        if (existingMember) {
            throw new Error(`A team member is already assigned to category ${role} on this project`);
        }

        const teamMember = await prisma.projectTeam.create({
            data: {
                projectId,
                userId,
                role,
                bidId: bidId || null,
                status: "ACTIVE",
            },
            include: { user: true, project: true },
        });

        await AuditService.logAction({
            adminId: adminUser.id,
            action: "ADMIN_ASSIGN_PROJECT_TEAM_MEMBER",
            entityType: "PROJECT_TEAM",
            entityId: teamMember.id,
            details: { projectId, assignedUserId: userId, role, bidId },
            req,
        });

        return teamMember;
    }

    /**
     * Get all chats metadata across the platform
     */
    static async getAllChatsAdmin({ page = 1, limit = 20, skip = 0, projectId, type, search }) {
        const where = {};
        if (projectId) where.projectId = projectId;
        if (type) where.type = type;

        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { project: { title: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [chats, total] = await Promise.all([
            prisma.chat.findMany({
                where,
                include: {
                    project: { select: { id: true, title: true, status: true } },
                    participants: {
                        include: { user: { select: { id: true, name: true, email: true, role: true } } },
                    },
                    _count: { select: { messages: true } },
                },
                orderBy: { updatedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.chat.count({ where }),
        ]);

        return {
            chats,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Admin view chat messages history
     */
    static async getChatMessagesAdmin(chatId, { page = 1, limit = 50 }) {
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (parsedPage - 1) * parsedLimit;

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: { chatId },
                include: {
                    sender: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: "asc" },
                skip,
                take: parsedLimit,
            }),
            prisma.message.count({ where: { chatId } }),
        ]);

        return {
            messages,
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit) || 1,
            },
        };
    }

    /**
     * Admin delete/moderate inappropriate message
     */
    static async deleteMessageAdmin(adminUser, messageId, { reason }, req = null) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) throw new Error("Message not found");

        await prisma.message.delete({ where: { id: messageId } });

        await AuditService.logAction({
            adminId: adminUser.id,
            action: "ADMIN_DELETE_CHAT_MESSAGE",
            entityType: "CHAT_MESSAGE",
            entityId: messageId,
            details: { chatId: message.chatId, senderId: message.senderId, reason },
            req,
        });

        return { success: true, message: "Message removed by administrator" };
    }

    /**
     * Admin extend project bidding deadline
     */
    static async extendProjectBiddingDeadline(adminUser, projectId, { newDeadline }, req = null) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error("Project not found");

        const deadlineDate = new Date(newDeadline);
        if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
            throw new Error("New deadline must be a valid future date");
        }

        const updated = await prisma.project.update({
            where: { id: projectId },
            data: {
                biddingDeadline: deadlineDate,
                availabilityStatus: "OPEN",
            },
        });

        await AuditService.logAction({
            adminId: adminUser.id,
            action: "ADMIN_EXTEND_PROJECT_DEADLINE",
            entityType: "PROJECT",
            entityId: projectId,
            details: { previousDeadline: project.biddingDeadline, newDeadline: deadlineDate },
            req,
        });

        return updated;
    }

    /**
     * Comprehensive Dashboard Analytics & KPIs for Bidding and Chat
     */
    static async getDashboardAnalytics() {
        const [
            totalProjects,
            projectsByStatus,
            totalBids,
            bidsByStatus,
            bidsByRole,
            bidStats,
            totalChats,
            totalMessages,
            directChatsCount,
            teamChatsCount,
            activeTeamMembers,
        ] = await Promise.all([
            prisma.project.count({ where: { isDeleted: false } }),
            prisma.project.groupBy({
                by: ["status"],
                where: { isDeleted: false },
                _count: { status: true },
            }),
            prisma.bid.count(),
            prisma.bid.groupBy({
                by: ["status"],
                _count: { status: true },
            }),
            prisma.bid.groupBy({
                by: ["role"],
                _count: { role: true },
            }),
            prisma.bid.aggregate({
                _sum: { amount: true },
                _avg: { amount: true },
                _min: { amount: true },
                _max: { amount: true },
            }),
            prisma.chat.count(),
            prisma.message.count(),
            prisma.chat.count({ where: { type: "DIRECT" } }),
            prisma.chat.count({ where: { type: "PROJECT_TEAM" } }),
            prisma.projectTeam.count({ where: { status: "ACTIVE" } }),
        ]);

        const projectStatusMap = Object.fromEntries(projectsByStatus.map((p) => [p.status, p._count.status]));
        const bidStatusMap = Object.fromEntries(bidsByStatus.map((b) => [b.status, b._count.status]));
        const bidRoleMap = Object.fromEntries(bidsByRole.map((b) => [b.role || "UNASSIGNED", b._count.role]));

        const acceptedBids = bidStatusMap.ACCEPTED || 0;
        const conversionRate = totalBids > 0 ? Number(((acceptedBids / totalBids) * 100).toFixed(2)) : 0;

        return {
            projects: {
                total: totalProjects,
                byStatus: projectStatusMap,
                activeTeamMembers,
            },
            bids: {
                total: totalBids,
                byStatus: bidStatusMap,
                byRole: bidRoleMap,
                conversionRatePercentage: conversionRate,
                volume: {
                    totalAmount: bidStats._sum.amount || 0,
                    averageAmount: Number((bidStats._avg.amount || 0).toFixed(2)),
                    minAmount: bidStats._min.amount || 0,
                    maxAmount: bidStats._max.amount || 0,
                },
            },
            chats: {
                totalRooms: totalChats,
                directChats: directChatsCount,
                projectTeamChats: teamChatsCount,
                totalMessages,
            },
        };
    }
}

export default AdminManagementService;
