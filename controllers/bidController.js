import helper from "../helper/helper.js";
import BidService from "../services/bidService.js";

class BidController {
    /**
     * Create a bid
     * POST /api/bids/projects/:projectId/bids
     */
    static async createBid(req, res, next) {
        try {
            const { projectId } = req.params;
            const bid = await BidService.createBid(req.user, projectId, req.body);
            return helper.success(res, "Bid submitted successfully", bid);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get all bids for a project (grouped by category)
     * GET /api/bids/projects/:projectId/bids
     */
    static async getBidsForProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const user = req.user || req.admin;
            const bids = await BidService.getBidsForProject(user, projectId, req.query);
            return helper.success(res, "Project bids fetched successfully", bids);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

    /**
     * Get bid by ID
     * GET /api/bids/bids/:bidId
     */
    static async getBidById(req, res, next) {
        try {
            const { bidId } = req.params;
            const user = req.user || req.admin;
            const bid = await BidService.getBidById(user, bidId);
            return helper.success(res, "Bid details fetched successfully", bid);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 404);
        }
    }

    /**
     * Update bid
     * PATCH /api/bids/bids/:bidId
     */
    static async updateBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const updated = await BidService.updateBid(req.user, bidId, req.body);
            return helper.success(res, "Bid updated successfully", updated);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Withdraw bid
     * DELETE /api/bids/bids/:bidId or POST /api/bids/bids/:bidId/withdraw
     */
    static async withdrawBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const withdrawn = await BidService.withdrawBid(req.user, bidId);
            return helper.success(res, "Bid withdrawn successfully", withdrawn);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Shortlist bid
     * PATCH /api/bids/bids/:bidId/shortlist
     */
    static async shortlistBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const isShortlisted = req.body.isShortlisted !== false;
            const result = await BidService.shortlistBid(req.user.id, bidId, isShortlisted);
            return helper.success(
                res,
                isShortlisted ? "Bid shortlisted successfully" : "Bid removed from shortlist",
                result
            );
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Award / Accept bid
     * POST /api/bids/bids/:bidId/award
     */
    static async awardBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const result = await BidService.acceptBid(req.user.id, bidId, req);
            return helper.success(res, "Bid awarded and contract created successfully", result);
        } catch (error) {
            const statusCode = error.statusCode || (error.message.includes("already") || error.message.includes("concurrent") ? 409 : 400);
            return helper.failed(res, error.message, {}, statusCode);
        }
    }

    /**
     * Reject bid
     * POST /api/bids/bids/:bidId/reject
     */
    static async rejectBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const { reason } = req.body;
            const result = await BidService.rejectBid(req.user.id, bidId, reason);
            return helper.success(res, "Bid rejected successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }

    /**
     * Get bids submitted by logged-in professional
     * GET /api/bids/me
     */
    static async getMyBids(req, res, next) {
        try {
            const result = await BidService.getMyBids(req.user, req.query);
            return helper.success(res, "My bids fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.statusCode || 400);
        }
    }
}

export default BidController;