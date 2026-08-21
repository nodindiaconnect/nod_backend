import prisma from "../config/prismaClient.js";

class AuditService {
    /**
     * Log an administrative or system action
     */
    static async logAction({ adminId, action, entityType, entityId = null, details = null, req = null }) {
        try {
            let ipAddress = null;
            let userAgent = null;

            if (req) {
                ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
                userAgent = req.headers["user-agent"] || null;
            }

            return await prisma.auditLog.create({
                data: {
                    adminId: adminId || null,
                    action,
                    entityType,
                    entityId: entityId ? String(entityId) : null,
                    details: details ? (typeof details === "object" ? details : { info: details }) : undefined,
                    ipAddress: ipAddress ? String(ipAddress) : null,
                    userAgent: userAgent ? String(userAgent).substring(0, 500) : null,
                },
            });
        } catch (error) {
            console.error("AuditService.logAction error:", error);
            // Non-blocking: audit failure should not break critical paths, but log to console/winston
            return null;
        }
    }

    /**
     * Get paginated audit logs with search and filters
     */
    static async getAuditLogs({
        adminId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 20,
        skip = 0,
    }) {
        const where = {};

        if (adminId) where.adminId = adminId;
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (search) {
            where.OR = [
                { action: { contains: search, mode: "insensitive" } },
                { entityType: { contains: search, mode: "insensitive" } },
                { entityId: { contains: search, mode: "insensitive" } },
            ];
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    admin: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            username: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }
}

export default AuditService;
