import helper from "../helper/helper.js";
import PaymentService from "../services/paymentService.js";
import EscrowService from "../services/escrowService.js";
import SystemConfigService from "../services/systemConfigService.js";
import PaymentCalculationService from "../services/paymentCalculationService.js";
import InvoiceService from "../services/invoiceService.js";
import InvoicePdfService from "../services/invoicePdfService.js";
import logger from "../helper/logger.js";

class PaymentController {
    /**
     * Get Dynamic Platform Fee Configuration (Public / Authenticated)
     * GET /api/payments/platform-fee
     */
    static async getPlatformFeeConfig(req, res, next) {
        try {
            const fee = await SystemConfigService.getPlatformFeePercentage();
            return helper.success(res, "Platform fee retrieved", { platformFeePercentage: fee });
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get Centralized Project Payment & Milestone Breakdown Summary
     * GET /api/payments/projects/:projectId/summary
     */
    static async getProjectPaymentSummary(req, res, next) {
        try {
            const { projectId } = req.params;
            const summary = await PaymentCalculationService.calculateProjectPaymentSummary(projectId);
            return helper.success(res, "Project payment summary calculated successfully", summary);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Unified Milestone Payment Execution (1: 50% Advance, 2: 25% Second, 3: 25% Final)
     * POST /api/payments/projects/:projectId/pay-milestone
     */
    static async payProjectMilestone(req, res, next) {
        try {
            const { projectId } = req.params;
            const { milestoneSequence } = req.body;
            const result = await EscrowService.payMilestone(req.user, projectId, milestoneSequence, req.body);
            return helper.success(res, `Milestone ${milestoneSequence} payment processed successfully`, result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get All Invoices for a Project
     * GET /api/payments/projects/:projectId/invoices
     */
    static async getProjectInvoices(req, res, next) {
        try {
            const { projectId } = req.params;
            const invoices = await InvoiceService.getProjectInvoices(projectId, req.user || req.admin);
            return helper.success(res, "Project invoices fetched successfully", invoices);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get Single Invoice Details by ID
     * GET /api/payments/invoices/:invoiceId
     */
    static async getInvoiceById(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const invoice = await InvoiceService.getInvoiceById(invoiceId, req.user || req.admin);
            return helper.success(res, "Invoice fetched successfully", invoice);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Download Invoice as PDF Stream
     * GET /api/payments/invoices/:invoiceId/pdf
     */
    static async downloadInvoicePdf(req, res, next) {
        try {
            const { invoiceId } = req.params;
            await InvoicePdfService.streamInvoicePdf(invoiceId, req.user || req.admin, res);
        } catch (error) {
            logger.error(`[PaymentController] Failed to generate invoice PDF: ${error.message}`);
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get Project Escrow Details (Role-Aware)
     * GET /api/payments/projects/:projectId/escrow
     */
    static async getProjectEscrow(req, res, next) {
        try {
            const { projectId } = req.params;
            const result = await EscrowService.getProjectEscrow(req.user || req.admin, projectId);
            return helper.success(res, "Project escrow details fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Create Order for Initial 50% Escrow Deposit + Platform Fee
     * POST /api/payments/projects/:projectId/initial-escrow-order
     */
    static async createInitialEscrowOrder(req, res, next) {
        try {
            const { projectId } = req.params;
            const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
            const result = await EscrowService.createInitialEscrowOrder(req.user, projectId, idempotencyKey);
            return helper.success(res, "Initial escrow deposit order created", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Confirm Initial 50% Deposit + 5% Platform Fee Payment
     * POST /api/payments/projects/:projectId/confirm-initial-escrow
     */
    static async confirmInitialEscrowPayment(req, res, next) {
        try {
            const { projectId } = req.params;
            const result = await EscrowService.confirmInitialEscrowPayment(req.user, projectId, req.body);
            return helper.success(res, "Initial escrow funded and 5% platform fee recorded successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Client Approves Milestone & Releases Funds from Project Escrow directly to Pro's Personal Wallet
     * POST /api/payments/milestones/:milestoneId/approve
     */
    static async approveMilestone(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const result = await EscrowService.approveMilestoneAndReleaseEscrow(req.user, milestoneId);
            return helper.success(res, "Milestone approved and escrow funds released to specialist's wallet successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Client Rejects Milestone & Requests Revision
     * POST /api/payments/milestones/:milestoneId/reject
     */
    static async rejectMilestone(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const { reason } = req.body;
            const result = await EscrowService.rejectMilestone(req.user, milestoneId, reason);
            return helper.success(res, "Milestone returned for revision", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Raise Dispute on Milestone / Project
     * POST /api/payments/projects/:projectId/disputes
     */
    static async raiseDispute(req, res, next) {
        try {
            const { projectId } = req.params;
            const { milestoneId, reason, description, evidenceUrls } = req.body;
            const result = await EscrowService.raiseDispute(req.user, projectId, milestoneId, {
                reason,
                description,
                evidenceUrls,
            });
            return helper.success(res, "Dispute raised successfully. Funds locked in Escrow pending Admin review.", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Create Razorpay Payment Order for Milestone
     * POST /api/payments/milestones/:milestoneId/create-order
     */
    static async createPaymentOrder(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
            const order = await PaymentService.createPaymentOrder(req.user, milestoneId, idempotencyKey);
            return helper.success(res, "Payment order created successfully", order);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Start work on Milestone
     * POST /api/payments/milestones/:milestoneId/start
     */
    static async startMilestone(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const result = await PaymentService.startMilestone(req.user, milestoneId);
            return helper.success(res, "Milestone marked in progress", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Submit milestone for review
     * POST /api/payments/milestones/:milestoneId/submit
     */
    static async submitMilestone(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const { proofUrls, notes } = req.body;
            const result = await PaymentService.submitMilestoneForReview(req.user, milestoneId, { proofUrls, notes });
            return helper.success(res, "Milestone submitted for review", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Legacy Dispute alias
     * POST /api/payments/milestones/:milestoneId/dispute
     */
    static async disputeMilestone(req, res, next) {
        try {
            const { milestoneId } = req.params;
            const { reason, description, evidenceUrls, projectId } = req.body;

            // Fetch milestone to get projectId if missing
            let targetProjectId = projectId;
            if (!targetProjectId) {
                const ms = await prisma.milestone.findUnique({
                    where: { id: milestoneId },
                    include: { contract: { include: { award: true } } },
                });
                targetProjectId = ms?.contract?.award?.projectId;
            }

            const result = await EscrowService.raiseDispute(req.user, targetProjectId, milestoneId, {
                reason: reason || "Milestone deliverable disputed",
                description,
                evidenceUrls,
            });
            return helper.success(res, "Milestone marked disputed", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Get Project Contracts and Milestones
     * GET /api/payments/projects/:projectId/milestones
     */
    static async getProjectMilestones(req, res, next) {
        try {
            const { projectId } = req.params;
            const result = await PaymentService.getProjectContractsAndMilestones(req.user || req.admin, projectId);
            return helper.success(res, "Project milestones fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Get My Payments
     * GET /api/payments/me
     */
    static async getMyPayments(req, res, next) {
        try {
            const result = await PaymentService.getMyPayments(req.user, req.query);
            return helper.success(res, "Payments fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Razorpay Webhook Handler
     * POST /api/webhooks/payments/razorpay
     */
    static async handleRazorpayWebhook(req, res, next) {
        try {
            const signature = req.headers["x-razorpay-signature"];
            const rawBody = req.rawBody || JSON.stringify(req.body);

            logger.info("[Webhook] Received Razorpay payment webhook");

            const result = await PaymentService.handleRazorpayWebhook(rawBody, signature, req.body);

            return res.status(200).json({
                status: "success",
                message: "Webhook processed successfully",
                ...result,
            });
        } catch (error) {
            logger.error(`[Webhook Error] ${error.message}`);
            return res.status(400).json({
                status: "error",
                message: error.message,
            });
        }
    }
}

export default PaymentController;