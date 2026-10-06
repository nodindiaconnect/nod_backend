import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

class FinancialLedgerService {
    /**
     * Generate sequential internal transaction ID
     */
    static generateInternalTxnId(type = "TXN") {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rand = Math.floor(100000 + Math.random() * 900000);
        return `${type}-NOD-${dateStr}-${rand}`;
    }

    /**
     * Record an immutable financial transaction in the ledger
     */
    static async recordTransaction({
        projectId,
        milestoneId = null,
        invoiceId = null,
        userId,
        type,
        amount,
        currency = "INR",
        gateway = "RAZORPAY",
        gatewayTransactionId = null,
        status = "COMPLETED",
        metadata = null,
    }, tx = prisma) {
        // Idempotency check on gatewayTransactionId if provided
        if (gatewayTransactionId) {
            const existing = await tx.financialTransaction.findFirst({
                where: { gatewayTransactionId, type },
            });
            if (existing) {
                logger.info(`[FinancialLedgerService] Idempotent hit: transaction for ${gatewayTransactionId} already exists`);
                return existing;
            }
        }

        const internalTxnId = FinancialLedgerService.generateInternalTxnId("TXN");

        const transaction = await tx.financialTransaction.create({
            data: {
                internalTxnId,
                projectId,
                milestoneId,
                invoiceId,
                userId,
                type,
                amount: Math.round(Number(amount) * 100) / 100,
                currency,
                gateway,
                gatewayTransactionId,
                status,
                metadata: metadata ? metadata : undefined,
            },
        });

        logger.info(`[FinancialLedgerService] Recorded ${type} of ₹${amount} for user ${userId} on project ${projectId}`);
        return transaction;
    }

    /**
     * Add an item to the Designer Manual Payout Queue upon payment capture / milestone release
     */
    static async enqueueDesignerPayout({
        projectId,
        milestoneId = null,
        designerId,
        clientPaymentId = null,
        grossAmount,
        designerCommission = 0,
        nonRefundableFee = 0,
        eligiblePayoutAmount,
    }, tx = prisma) {
        const payout = await tx.designerPayoutQueue.create({
            data: {
                projectId,
                milestoneId,
                designerId,
                clientPaymentId,
                grossAmount: Number(grossAmount) || 0,
                designerCommission: Number(designerCommission) || 0,
                nonRefundableFee: Number(nonRefundableFee) || 0,
                eligiblePayoutAmount: Number(eligiblePayoutAmount) || 0,
                status: "PENDING",
            },
        });

        logger.info(`[FinancialLedgerService] Enqueued designer payout for designer ${designerId}, eligible ₹${eligiblePayoutAmount}`);
        return payout;
    }

    /**
     * Admin confirms manual payout (Bank/UPI transfer done by NOD admin)
     */
    static async confirmManualPayout(adminUser, payoutId, payoutData = {}) {
        const {
            bankReferenceNumber,
            paymentMethod = "BANK_TRANSFER",
            paymentDate = new Date(),
            notes = "",
            proofImageUrl = null,
        } = payoutData;

        if (!bankReferenceNumber || String(bankReferenceNumber).trim().length === 0) {
            throw new Error("Bank / UPI Reference Number is strictly required to confirm payout.");
        }

        return await prisma.$transaction(async (tx) => {
            const payout = await tx.designerPayoutQueue.findUnique({
                where: { id: payoutId },
                include: { project: true },
            });

            if (!payout) throw new Error("Payout queue item not found");
            if (payout.status === "PAID") {
                throw new Error("This payout has already been marked as PAID.");
            }
            if (payout.status === "CANCELLED") {
                throw new Error("Cannot pay a cancelled payout item.");
            }

            const updatedPayout = await tx.designerPayoutQueue.update({
                where: { id: payoutId },
                data: {
                    status: "PAID",
                    bankReferenceNumber: String(bankReferenceNumber).trim(),
                    paymentMethod,
                    paymentDate: new Date(paymentDate),
                    processedById: adminUser.id,
                    notes: notes ? String(notes).trim() : null,
                    proofImageUrl: proofImageUrl ? String(proofImageUrl).trim() : null,
                },
            });

            // Record in immutable financial ledger
            await tx.financialTransaction.create({
                data: {
                    internalTxnId: FinancialLedgerService.generateInternalTxnId("POUT"),
                    projectId: payout.projectId,
                    milestoneId: payout.milestoneId,
                    userId: payout.designerId,
                    type: "DESIGNER_SETTLEMENT",
                    amount: payout.eligiblePayoutAmount,
                    currency: "INR",
                    gateway: "MANUAL_BANK_TRANSFER",
                    gatewayTransactionId: bankReferenceNumber,
                    status: "COMPLETED",
                    metadata: {
                        payoutQueueId: payout.id,
                        adminId: adminUser.id,
                        paymentMethod,
                        notes,
                    },
                },
            });

            // Log Audit trail
            await tx.auditLog.create({
                data: {
                    adminId: adminUser.id,
                    action: "MANUAL_PAYOUT_CONFIRMED",
                    entityType: "DESIGNER_PAYOUT_QUEUE",
                    entityId: payout.id,
                    details: {
                        payoutId: payout.id,
                        designerId: payout.designerId,
                        eligiblePayoutAmount: payout.eligiblePayoutAmount,
                        bankReferenceNumber,
                        paymentMethod,
                        adminId: adminUser.id,
                    },
                },
            });

            return updatedPayout;
        });
    }

    /**
     * Fetch Admin Payout Queue with filters and pagination
     */
    static async getAdminPayoutQueue(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const skip = (page - 1) * limit;
        const { status, search } = query;

        const where = {};
        if (status && ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID", "REJECTED", "FAILED", "ON_HOLD", "CANCELLED"].includes(status)) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { bankReferenceNumber: { contains: search, mode: "insensitive" } },
                { project: { title: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [payouts, total] = await Promise.all([
            prisma.designerPayoutQueue.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    project: {
                        select: {
                            id: true,
                            title: true,
                            projectDeliveryType: true,
                            client: { select: { id: true, name: true, email: true, phone: true } },
                        },
                    },
                },
            }),
            prisma.designerPayoutQueue.count({ where }),
        ]);

        return {
            payouts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }
}

export default FinancialLedgerService;
