import { Router } from "express";
import AdminDashboardController from "../../controllers/admin/adminDashboardController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

// Apply Auth and verifyAdmin
router.use(Auth, verifyAdmin);

// Dashboard stats (bids, projects, chats)
router.get("/stats", checkPermission("DASHBOARD"), AdminDashboardController.getDashboardStats);

// Audit logs
router.get("/audit-logs", AdminDashboardController.getAuditLogs);

export default router;
