import helper from "../../helper/helper.js";
import AdminManagementService from "../../services/adminManagementService.js";
import AuditService from "../../services/auditService.js";

class AdminDashboardController {
    /**
     * Get bidding & chat analytics and dashboard statistics
     * GET /api/Admin/dashboard/stats
     */
    static async getDashboardStats(req, res, next) {
        try {
            const stats = await AdminManagementService.getDashboardAnalytics();
            return helper.success(res, "Dashboard analytics fetched successfully", stats);
        } catch (error) {
            return helper.failed(res, error.message, {}, 500);
        }
    }

    /**
     * Get paginated audit logs
     * GET /api/Admin/dashboard/audit-logs
     */
    static async getAuditLogs(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const skip = (page - 1) * limit;

            const result = await AuditService.getAuditLogs({
                page,
                limit,
                skip,
                adminId: req.query.adminId,
                action: req.query.action,
                entityType: req.query.entityType,
                entityId: req.query.entityId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                search: req.query.search,
            });

            return helper.success(res, "Audit logs fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default AdminDashboardController;
