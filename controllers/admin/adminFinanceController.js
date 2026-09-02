import helper from "../../helper/helper.js";
import EscrowService from "../../services/escrowService.js";
import SystemConfigService from "../../services/systemConfigService.js";
import prisma from "../../config/prismaClient.js";

class AdminFinanceController {
    /**
     * Get Dynamic Platform Fee Percentage
     * GET /api/admin/finance/platform-fee
     */
    static async getPlatformFee(req, res, next) {
        try {
            const fee = await SystemConfigService.getPlatformFeePercentage();
            return helper.success(res, "Platform fee retrieved successfully", { platformFeePercentage: fee });
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Update Dynamic Platform Fee Percentage (Admin only)
     * PATCH /api/admin/finance/platform-fee
     */
    static async updatePlatformFee(req, res, next) {
        try {
            const { platformFeePercentage } = req.body;
            const adminUser = req.user || req.admin;
            const result = await SystemConfigService.updatePlatformFeePercentage(adminUser, platformFeePercentage, req);
            return helper.success(res, "Platform fee configuration updated successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Master Financial Overview & KPI Metrics
     * GET /api/Admin/finance/overview
     */
    static async getFinancialOverview(req, res, next) {
        try {
            const overview = await EscrowService.getAdminFinancialOverview();
            return helper.success(res, "Financial overview fetched successfully", overview);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * List all Project Escrow Wallets
     * GET /api/Admin/finance/escrows
     */
    static async getProjectEscrows(req, res, next) {
        try {
            const result = await EscrowService.getAdminProjectEscrows(req.query);
            return helper.success(res, "Project escrows fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * List all Project Disputes
     * GET /api/Admin/finance/disputes
     */
    static async getDisputes(req, res, next) {
        try {
            const result = await EscrowService.getAdminDisputes(req.query);
            return helper.success(res, "Disputes fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get Dispute by ID with Audit Details
     * GET /api/Admin/finance/disputes/:disputeId
     */
    static async getDisputeById(req, res, next) {
        try {
            const { disputeId } = req.params;
            const dispute = await prisma.projectDispute.findUnique({
                where: { id: disputeId },
                include: {
                    raisedBy: { select: { id: true, name: true, email: true, role: true, phone: true } },
                    resolvedBy: { select: { id: true, name: true, email: true } },
                    escrow: {
                        include: {
                            project: {
                                include: {
                                    client: { select: { id: true, name: true, email: true, phone: true } },
                                    awards: {
                                        include: {
                                            bid: {
                                                include: {
                                                    professional: { select: { id: true, name: true, email: true, phone: true } },
                                                },
                                            },
                                            contract: {
                                                include: { milestones: true },
                                            },
                                        },
                                    },
                                },
                            },
                            transactions: {
                                orderBy: { createdAt: "desc" },
                                take: 20,
                            },
                        },
                    },
                },
            });

            if (!dispute) {
                return helper.failed(res, "Dispute not found", {}, 404);
            }

            return helper.success(res, "Dispute details fetched successfully", dispute);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Resolve Project Dispute (Release to Pro, Refund to Client, Split)
     * POST /api/Admin/finance/disputes/:disputeId/resolve
     */
    static async resolveDispute(req, res, next) {
        try {
            const { disputeId } = req.params;
            const adminUser = req.user || req.admin;
            const result = await EscrowService.resolveDisputeByAdmin(adminUser, disputeId, req.body);
            return helper.success(res, "Dispute resolved successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Platform Fee Revenue Ledger (5% Platform Fees collected)
     * GET /api/Admin/finance/platform-revenue
     */
    static async getPlatformRevenueLedger(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
            const skip = (page - 1) * limit;

            const [revenues, total, totalAmountAgg] = await Promise.all([
                prisma.platformRevenue.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.platformRevenue.count(),
                prisma.platformRevenue.aggregate({
                    _sum: { amount: true },
                }),
            ]);

            return helper.success(res, "Platform revenue ledger fetched", {
                revenues,
                totalRevenueCollected: totalAmountAgg._sum.amount || 0,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit) || 1,
                },
            });
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default AdminFinanceController;
