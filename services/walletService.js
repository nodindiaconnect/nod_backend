import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

class WalletService {
    /**
     * Get user's private personal wallet balance and ledger history
     * (Strictly private to the authenticated user)
     */
    static async getMyWallet(user) {
        if (!user || !user.id) {
            throw new Error("Unauthorized: Authentication required");
        }

        const wallet = await prisma.wallet.upsert({
            where: { userId: user.id },
            update: {},
            create: {
                userId: user.id,
                totalAvailableBalance: 0,
                createdBy: user.id,
                updatedBy: user.id,
            },
        });

        const [withdrawals, escrowPayouts] = await Promise.all([
            prisma.withdrawal.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.projectEscrowTransaction.findMany({
                where: {
                    userId: user.id,
                    type: { in: ["MILESTONE_RELEASE", "DISPUTE_RELEASE_PRO"] },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
                include: {
                    escrow: {
                        include: {
                            project: { select: { id: true, title: true } },
                        },
                    },
                },
            }),
        ]);

        const pendingWithdrawalAmount = withdrawals
            .filter((w) => w.status === "PENDING" || w.status === "PROCESSING")
            .reduce((sum, w) => sum + (w.amount || 0), 0);

        const totalWithdrawnAmount = withdrawals
            .filter((w) => w.status === "COMPLETED")
            .reduce((sum, w) => sum + (w.amount || 0), 0);

        const totalEarnedLifetime = escrowPayouts.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        return {
            walletId: wallet.id,
            userId: user.id,
            totalAvailableBalance: wallet.totalAvailableBalance,
            pendingWithdrawalAmount,
            totalWithdrawnAmount,
            totalEarnedLifetime,
            withdrawals,
            escrowPayouts,
        };
    }

    /**
     * Request a secure withdrawal from personal wallet
     * Uses atomic database transaction and balance validation to prevent race conditions
     */
    static async requestWithdrawal(user, data = {}) {
        const { amount, bankAccount, ifscCode, accountHolder, idempotencyKey } = data;
        const withdrawAmount = Number(amount);

        if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
            throw new Error("Withdrawal amount must be a positive number greater than zero");
        }

        if (user.isBlocked) {
            throw new Error("Your account is blocked and cannot request withdrawals");
        }

        if (idempotencyKey) {
            const existingWithdrawal = await prisma.withdrawal.findUnique({
                where: { idempotencyKey },
            });
            if (existingWithdrawal) {
                return existingWithdrawal;
            }
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Fetch wallet with lock
            const wallet = await tx.wallet.findUnique({
                where: { userId: user.id },
            });

            if (!wallet || wallet.totalAvailableBalance < withdrawAmount) {
                const available = wallet ? wallet.totalAvailableBalance : 0;
                throw new Error(
                    `Insufficient wallet balance. Available: ₹${available}, Requested: ₹${withdrawAmount}`
                );
            }

            // 2. Decrement available balance immediately
            const updatedWallet = await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    totalAvailableBalance: { decrement: withdrawAmount },
                    updatedBy: user.id,
                },
            });

            // 3. Create Withdrawal Record with status PENDING
            const withdrawal = await tx.withdrawal.create({
                data: {
                    walletId: wallet.id,
                    userId: user.id,
                    amount: withdrawAmount,
                    bankAccount: bankAccount || null,
                    ifscCode: ifscCode || null,
                    accountHolder: accountHolder || user.name || null,
                    status: "PENDING",
                    idempotencyKey: idempotencyKey || `withdr_${user.id}_${Date.now()}`,
                },
            });

            // 4. Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: null,
                    action: "WITHDRAWAL_REQUESTED",
                    entityType: "WITHDRAWAL",
                    entityId: withdrawal.id,
                    details: {
                        userId: user.id,
                        amount: withdrawAmount,
                        remainingBalance: updatedWallet.totalAvailableBalance,
                    },
                },
            });

            return withdrawal;
        });
    }

    /**
     * Admin/System updates withdrawal status (PROCESSING -> COMPLETED | FAILED)
     */
    static async updateWithdrawalStatus(adminUser, withdrawalId, status, failureReason = null) {
        if (!["PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
            throw new Error(`Invalid withdrawal status: ${status}`);
        }

        return await prisma.$transaction(async (tx) => {
            const withdrawal = await tx.withdrawal.findUnique({
                where: { id: withdrawalId },
                include: { wallet: true },
            });

            if (!withdrawal) throw new Error("Withdrawal record not found");

            if (withdrawal.status === "COMPLETED") {
                throw new Error("Cannot modify an already completed withdrawal");
            }

            if (withdrawal.status === "FAILED") {
                throw new Error("Cannot modify an already failed withdrawal");
            }

            // If withdrawal failed, refund the amount back to user's wallet
            if (status === "FAILED") {
                await tx.wallet.update({
                    where: { id: withdrawal.walletId },
                    data: {
                        totalAvailableBalance: { increment: withdrawal.amount },
                        updatedBy: adminUser.id,
                    },
                });
            }

            const updatedWithdrawal = await tx.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status,
                    failureReason: status === "FAILED" ? failureReason : null,
                },
            });

            // Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: adminUser.id,
                    action: `WITHDRAWAL_${status}`,
                    entityType: "WITHDRAWAL",
                    entityId: withdrawal.id,
                    details: {
                        withdrawalId,
                        userId: withdrawal.userId,
                        amount: withdrawal.amount,
                        status,
                        failureReason,
                    },
                },
            });

            return updatedWithdrawal;
        });
    }
}

export default WalletService;
