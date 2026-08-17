import { Router } from "express";
import PaymentController from "../controllers/paymentController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Create payment
router.post(
    "/payments",
    Auth,
    PaymentController.createPayment
);

// Get payment by ID
router.get(
    "/payments/:paymentId",
    Auth,
    PaymentController.getPaymentById
);

// Get payments for project
router.get(
    "/projects/:projectId/payments",
    Auth,
    PaymentController.getPaymentsForProject
);

// Get user's payments
router.get(
    "/users/:userId/payments",
    Auth,
    PaymentController.getMyPayments
);

export default router;