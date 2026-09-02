import helper from "../helper/helper.js";
import WalletService from "../services/walletService.js";

class WalletController {
    /**
     * Get My Personal Wallet (Strictly private)
     * GET /api/wallet/me
     */
    static async getMyWallet(req, res, next) {
        try {
            const result = await WalletService.getMyWallet(req.user);
            return helper.success(res, "Personal wallet fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Request Wallet Withdrawal
     * POST /api/wallet/withdraw
     */
    static async requestWithdrawal(req, res, next) {
        try {
            const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
            const result = await WalletService.requestWithdrawal(req.user, {
                ...req.body,
                idempotencyKey,
            });
            return helper.success(res, "Withdrawal request submitted successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Admin: Update Withdrawal Status (PROCESSING, COMPLETED, FAILED)
     * POST /api/Admin/finance/withdrawals/:withdrawalId/status
     */
    static async updateWithdrawalStatus(req, res, next) {
        try {
            const { withdrawalId } = req.params;
            const { status, failureReason } = req.body;
            const adminUser = req.user || req.admin;
            const result = await WalletService.updateWithdrawalStatus(adminUser, withdrawalId, status, failureReason);
            return helper.success(res, `Withdrawal marked ${status}`, result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }
}

export default WalletController;
