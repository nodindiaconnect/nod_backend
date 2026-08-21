import prisma from "../config/prismaClient.js";
import AuditService from "./auditService.js";

class ExpiryService {
    /**
     * Scan and transition all expired projects and bids
     */
    static async processExpiredBidsAndProjects(adminUser = null, req = null) {
        const now = new Date();
        const results = {
            expiredProjectsCount: 0,
            expiredBidsCount: 0,
        };

        try {
            // 1. Process expired individual bids where validUntil < now
            const expiredBids = await prisma.bid.findMany({
                where: {
                    status: "PENDING",
                    validUntil: { lt: now },
                },
            });

            if (expiredBids.length > 0) {
                const expiredBidIds = expiredBids.map((b) => b.id);

                await prisma.$transaction(async (tx) => {
                    await tx.bid.updateMany({
                        where: { id: { in: expiredBidIds } },
                        data: {
                            status: "EXPIRED",
                            rejectionReason: "Bid proposal validity period expired",
                        },
                    });

                    for (const bid of expiredBids) {
                        if (bid.architectId) {
                            await tx.architect.update({
                                where: { id: bid.architectId },
                                data: { quotationsPending: { decrement: 1 } },
                            });
                        } else if (bid.contractorId) {
                            await tx.contractor.update({
                                where: { id: bid.contractorId },
                                data: { quotationsPending: { decrement: 1 } },
                            });
                        }
                    }
                });

                results.expiredBidsCount += expiredBids.length;
            }

            // 2. Process expired projects whose bidding deadline passed without any accepted team members
            const expiredProjects = await prisma.project.findMany({
                where: {
                    availabilityStatus: "OPEN",
                    status: { in: ["WAITING_FOR_QUOTATIONS", "PROPOSALS_RECEIVED"] },
                    biddingDeadline: { lt: now },
                    isDeleted: false,
                },
                include: {
                    teamMembers: { where: { status: "ACTIVE" } },
                    bids: { where: { status: { in: ["PENDING", "SHORTLISTED"] } } },
                },
            });

            for (const project of expiredProjects) {
                if (project.teamMembers.length === 0) {
                    await prisma.$transaction(async (tx) => {
                        // Close project availability
                        await tx.project.update({
                            where: { id: project.id },
                            data: {
                                availabilityStatus: "CLOSED",
                            },
                        });

                        // Expire any remaining pending/shortlisted bids
                        if (project.bids.length > 0) {
                            const bidIds = project.bids.map((b) => b.id);
                            await tx.bid.updateMany({
                                where: { id: { in: bidIds } },
                                data: {
                                    status: "EXPIRED",
                                    rejectionReason: "Project bidding window closed",
                                },
                            });

                            for (const bid of project.bids) {
                                if (bid.architectId) {
                                    await tx.architect.update({
                                        where: { id: bid.architectId },
                                        data: { quotationsPending: { decrement: 1 } },
                                    });
                                } else if (bid.contractorId) {
                                    await tx.contractor.update({
                                        where: { id: bid.contractorId },
                                        data: { quotationsPending: { decrement: 1 } },
                                    });
                                }
                            }
                            results.expiredBidsCount += project.bids.length;
                        }
                    });

                    results.expiredProjectsCount += 1;
                }
            }

            if (adminUser) {
                await AuditService.logAction({
                    adminId: adminUser.id,
                    action: "TRIGGER_EXPIRY_SWEEP",
                    entityType: "SYSTEM",
                    entityId: null,
                    details: results,
                    req,
                });
            }

            return results;
        } catch (error) {
            console.error("ExpiryService.processExpiredBidsAndProjects error:", error);
            throw error;
        }
    }

    /**
     * Start recurring background scheduler
     */
    static startExpiryScheduler(intervalMs = 10 * 60 * 1000) {
        ExpiryService.processExpiredBidsAndProjects().catch((err) =>
            console.error("Initial expiry sweep error:", err)
        );

        return setInterval(() => {
            ExpiryService.processExpiredBidsAndProjects().catch((err) =>
                console.error("Recurring expiry sweep error:", err)
            );
        }, intervalMs);
    }
}

export default ExpiryService;
