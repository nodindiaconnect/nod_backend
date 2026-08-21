import { Router } from "express";
import AdminBiddingController from "../../controllers/admin/adminBiddingController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

// Apply Auth and verifyAdmin to all admin bidding routes
router.use(Auth, verifyAdmin, checkPermission("BIDS"));

// Get all bids with filters and search
router.get("/", AdminBiddingController.getAllBids);

// Trigger manual expiry sweep
router.post("/expiry-sweep", AdminBiddingController.triggerExpirySweep);

// Extend project bidding deadline
router.patch("/projects/:projectId/extend-deadline", AdminBiddingController.extendProjectDeadline);

// Get single bid details
router.get("/:bidId", AdminBiddingController.getBidDetails);

// Admin update bid status
router.patch("/:bidId/status", AdminBiddingController.updateBidStatus);

// Admin delete bid
router.delete("/:bidId", AdminBiddingController.deleteBid);

export default router;
