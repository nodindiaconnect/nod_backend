import { Router } from "express";
import PaymentController from "../controllers/paymentController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Dynamic Platform Fee (Public / Authenticated)
router.get("/platform-fee", PaymentController.getPlatformFeeConfig);

// Centralized Project Payment Summary
router.get(
    "/projects/:projectId/summary",
    Auth,
    PaymentController.getProjectPaymentSummary
);

// Unified Milestone Payment (50% Advance, 25% Second, 25% Final)
router.post(
    "/projects/:projectId/pay-milestone",
    Auth,
    PaymentController.payProjectMilestone
);

// Project Invoices
router.get(
    "/projects/:projectId/invoices",
    Auth,
    PaymentController.getProjectInvoices
);

// Single Invoice Details
router.get(
    "/invoices/:invoiceId",
    Auth,
    PaymentController.getInvoiceById
);

// Dedicated Project Wallet / Escrow Details (Role-Aware)
router.get(
    "/projects/:projectId/escrow",
    Auth,
    PaymentController.getProjectEscrow
);

// Initial 50% Deposit + 5% Platform Fee Order Creation
router.post(
    "/projects/:projectId/initial-escrow-order",
    Auth,
    PaymentController.createInitialEscrowOrder
);

// Confirm Initial 50% Deposit + 5% Platform Fee (Gateway Callback)
router.post(
    "/projects/:projectId/confirm-initial-escrow",
    Auth,
    PaymentController.confirmInitialEscrowPayment
);

// Raise Dispute on Milestone / Project
router.post(
    "/projects/:projectId/disputes",
    Auth,
    PaymentController.raiseDispute
);

// Create Razorpay payment order for a milestone
router.post(
    "/milestones/:milestoneId/create-order",
    Auth,
    PaymentController.createPaymentOrder
);

// Milestone lifecycle endpoints
router.post(
    "/milestones/:milestoneId/start",
    Auth,
    PaymentController.startMilestone
);

router.post(
    "/milestones/:milestoneId/submit",
    Auth,
    PaymentController.submitMilestone
);

// Client approves milestone -> triggers escrow release to Pro's personal wallet
router.post(
    "/milestones/:milestoneId/approve",
    Auth,
    PaymentController.approveMilestone
);

// Client rejects milestone -> requires revision
router.post(
    "/milestones/:milestoneId/reject",
    Auth,
    PaymentController.rejectMilestone
);

router.post(
    "/milestones/:milestoneId/dispute",
    Auth,
    PaymentController.disputeMilestone
);

// Get project contracts & milestones
router.get(
    "/projects/:projectId/milestones",
    Auth,
    PaymentController.getProjectMilestones
);

// Get user's payment history
router.get(
    "/me",
    Auth,
    PaymentController.getMyPayments
);

export default router;