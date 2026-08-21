import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createReview,
  getMyReviews,
  getReviewsForUser,
  getReviewsForProject,
  replyToReview,
  getEligibleToReview,
} from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", authenticate, createReview);
router.get("/me", authenticate, getMyReviews);
router.get("/eligible", authenticate, getEligibleToReview);
router.get("/user/:userId", getReviewsForUser);
router.get("/project/:projectId", getReviewsForProject);
router.post("/:reviewId/reply", authenticate, replyToReview);

export default router;
