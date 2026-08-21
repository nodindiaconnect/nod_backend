import { Router } from "express";
import BidController from "../controllers/bidController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Get bids submitted by the logged-in professional
router.get("/me", Auth, BidController.getMyBids);
router.get("/professionals/:proId/bids", Auth, BidController.getMyBids);

// Create a bid for a project
router.post("/projects/:projectId/bids", Auth, BidController.createBid);

// Get all bids for a project
router.get("/projects/:projectId/bids", Auth, BidController.getBidsForProject);

// Get single bid by ID
router.get("/bids/:bidId", Auth, BidController.getBidById);

// Update bid
router.patch("/bids/:bidId", Auth, BidController.updateBid);

// Withdraw bid
router.delete("/bids/:bidId", Auth, BidController.withdrawBid);
router.post("/bids/:bidId/withdraw", Auth, BidController.withdrawBid);

// Shortlist bid
router.patch("/bids/:bidId/shortlist", Auth, BidController.shortlistBid);

// Award / Accept bid
router.post("/bids/:bidId/award", Auth, BidController.awardBid);
router.post("/bids/:bidId/accept", Auth, BidController.awardBid);

// Reject bid
router.post("/bids/:bidId/reject", Auth, BidController.rejectBid);

export default router;