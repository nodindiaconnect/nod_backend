import express from "express";
import {Auth} from "../middleware/authenticate.js"
import {
  createReview,
  getMyReviews,
  getReviewsForUser,
  getReviewsForProject,
  replyToReview,
  getEligibleToReview,
  getReviewById,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", Auth, createReview);
router.get("/me", Auth, getMyReviews);
router.get("/eligible", Auth, getEligibleToReview);
router.get("/user/:userId", getReviewsForUser);
router.get("/project/:projectId", getReviewsForProject);
router.get("/:reviewId", getReviewById);
router.put("/:reviewId", Auth, updateReview);
router.delete("/:reviewId", Auth, deleteReview);
router.post("/:reviewId/reply", Auth, replyToReview);

export default router;
