import helper from "../../helper/helper.js";
import AdminManagementService from "../../services/adminManagementService.js";
import ExpiryService from "../../services/expiryService.js";

class AdminBiddingController {
    /**
     * Get all bids across the system with filters, search, pagination
     * GET /api/Admin/bids
     */
    static async getAllBids(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const skip = (page - 1) * limit;

            const result = await AdminManagementService.getAllBids({
                page,
                limit,
                skip,
                status: req.query.status,
                role: req.query.role,
                projectId: req.query.projectId,
                minAmount: req.query.minAmount,
                maxAmount: req.query.maxAmount,
                search: req.query.search,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            });

            return helper.success(res, "All bids fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get single bid with full relational context
     * GET /api/Admin/bids/:bidId
     */
    static async getBidDetails(req, res, next) {
        try {
            const { bidId } = req.params;
            const bid = await AdminManagementService.getBidDetailsAdmin(bidId);
            return helper.success(res, "Bid details fetched successfully", bid);
        } catch (error) {
            return helper.failed(res, error.message, {}, 404);
        }
    }

    /**
     * Admin override bid status
     * PATCH /api/Admin/bids/:bidId/status
     */
    static async updateBidStatus(req, res, next) {
        try {
            const { bidId } = req.params;
            const { status, reason } = req.body;

            if (!status) {
                return helper.failed(res, "Status is required", {}, 400);
            }

            const updated = await AdminManagementService.adminUpdateBidStatus(
                req.admin,
                bidId,
                { status, reason },
                req
            );

            return helper.success(res, "Bid status updated by administrator", updated);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Admin delete bid
     * DELETE /api/Admin/bids/:bidId
     */
    static async deleteBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const result = await AdminManagementService.deleteBidAdmin(req.admin, bidId, req);
            return helper.success(res, result.message, result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Trigger manual expiry sweep
     * POST /api/Admin/bids/expiry-sweep
     */
    static async triggerExpirySweep(req, res, next) {
        try {
            const results = await ExpiryService.processExpiredBidsAndProjects(req.admin, req);
            return helper.success(res, "Expiry sweep executed successfully", results);
        } catch (error) {
            return helper.failed(res, error.message, {}, 500);
        }
    }

    /**
     * Extend project bidding deadline
     * PATCH /api/Admin/bids/projects/:projectId/extend-deadline
     */
    static async extendProjectDeadline(req, res, next) {
        try {
            const { projectId } = req.params;
            const { newDeadline } = req.body;

            if (!newDeadline) {
                return helper.failed(res, "newDeadline is required", {}, 400);
            }

            const updated = await AdminManagementService.extendProjectBiddingDeadline(
                req.admin,
                projectId,
                { newDeadline },
                req
            );

            return helper.success(res, "Project bidding deadline extended successfully", updated);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default AdminBiddingController;
