import { Router } from "express";
import BidController from "../controllers/bidController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Create a bid for a project
router.post(
    "/projects/:projectId/bids",
    Auth,
    BidController.createBid
);

// Get all bids for a project
router.get(
    "/projects/:projectId/bids",
    Auth,
    BidController.getBidsForProject
);

// Get single bid
router.get(
    "/bids/:bidId",
    Auth,
    BidController.getBidById
);

// Update bid
router.patch(
    "/bids/:bidId",
    Auth,
    BidController.updateBid
);

// Withdraw bid
router.delete(
    "/bids/:bidId",
    Auth,
    BidController.withdrawBid
);

// Award bid
router.post(
    "/bids/:bidId/award",
    Auth,
    BidController.awardBid
);

// Reject bid
router.post(
    "/bids/:bidId/reject",
    Auth,
    BidController.rejectBid
);

// Get bids submitted by the logged-in professional
router.get(
    "/professionals/:proId/bids",
    Auth,
    BidController.getMyBids
);

export default router;