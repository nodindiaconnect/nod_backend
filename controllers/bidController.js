import helper from "../helper/helper.js";

class BidController {
    /**
     * Create a bid
     * proId, projectId, role, quote, timeline, portfolio
     */
    static async createBid(req, res, next) {
        try {
            // TODO: implement bid creation
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all bids for a project
     * Group by role:
     * {
     *   architects: [],
     *   contractors: [],
     *   designers: []
     * }
     */
    static async getBidsForProject(req, res, next) {
        try {
            // TODO: implement get project bids
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get bid by ID
     */
    static async getBidById(req, res, next) {
        try {
            // TODO: implement get bid by ID
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update bid
     * Only bid owner can update
     * Only when bid status is PENDING
     */
    static async updateBid(req, res, next) {
        try {
            // TODO: implement bid update
        } catch (error) {
            next(error);
        }
    }

    /**
     * Withdraw bid
     */
    static async withdrawBid(req, res, next) {
        try {
            // TODO: implement bid withdrawal
        } catch (error) {
            next(error);
        }
    }

    /**
     * Award bid
     *
     * - Set selected bid status to AWARDED
     * - Mark other bids in the same role/category as NOT_SELECTED
     * - Trigger contract creation
     * - Trigger payment/milestone schedule creation
     */
    static async awardBid(req, res, next) {
        try {
            // TODO: implement bid award
        } catch (error) {
            next(error);
        }
    }

    /**
     * Reject bid
     */
    static async rejectBid(req, res, next) {
        try {
            // TODO: implement bid rejection
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get bids submitted by logged-in professional
     */
    static async getMyBids(req, res, next) {
        try {
            // TODO: implement get professional bids
        } catch (error) {
            next(error);
        }
    }
}

export default BidController;