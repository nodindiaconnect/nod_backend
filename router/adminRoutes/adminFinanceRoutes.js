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

// Withdrawals Management
router.get("/withdrawals", Auth, verifyAdmin, AdminFinanceController.getWithdrawals);
router.post("/withdrawals/:withdrawalId/status", Auth, verifyAdmin, AdminFinanceController.updateWithdrawalStatus);

// Admin Designer Manual Payout Queue
router.get("/payouts-queue", Auth, verifyAdmin, AdminFinanceController.getPayoutsQueue);
router.post("/payouts-queue/:payoutId/confirm", Auth, verifyAdmin, AdminFinanceController.confirmManualPayout);

// Monthly Reports & Multi-Sheet Excel Export
router.get("/monthly-report", Auth, verifyAdmin, AdminFinanceController.getMonthlyFinancialReport);
router.get("/export-excel", Auth, verifyAdmin, AdminFinanceController.exportMonthlyExcel);

export default router;
