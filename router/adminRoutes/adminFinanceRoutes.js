import { Router } from "express";
import AdminFinanceController from "../../controllers/admin/adminFinanceController.js";
import { Auth, verifyAdmin } from "../../middleware/authenticate.js";

const router = Router();

// Master Financial Overview & KPIs
router.get("/overview", Auth, verifyAdmin, AdminFinanceController.getFinancialOverview);

// All Project Escrow Wallets
router.get("/escrows", Auth, verifyAdmin, AdminFinanceController.getProjectEscrows);

// Disputes Management
router.get("/disputes", Auth, verifyAdmin, AdminFinanceController.getDisputes);
router.get("/disputes/:disputeId", Auth, verifyAdmin, AdminFinanceController.getDisputeById);
router.post("/disputes/:disputeId/resolve", Auth, verifyAdmin, AdminFinanceController.resolveDispute);

// Platform Fee Revenue Ledger
router.get("/platform-revenue", Auth, verifyAdmin, AdminFinanceController.getPlatformRevenueLedger);

// Platform Fee Configuration
router.get("/platform-fee", Auth, verifyAdmin, AdminFinanceController.getPlatformFee);
router.patch("/platform-fee", Auth, verifyAdmin, AdminFinanceController.updatePlatformFee);

export default router;
