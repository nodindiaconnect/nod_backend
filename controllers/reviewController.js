import reviewService from "../services/reviewService.js";

export const createReview = async (req, res) => {
  try {
    const review = await reviewService.createReview(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.error("Create Review Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to submit review",
    });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const data = await reviewService.getMyReviews(req.user, req.query);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get My Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch your reviews",
    });
  }
};

export const getReviewsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await reviewService.getReviewsForUser(userId, req.query);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get User Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user reviews",
    });
  }
};

export const getReviewsForProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const data = await reviewService.getReviewsForProject(projectId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Project Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch project reviews",
    });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;
    const data = await reviewService.replyToReview(req.user, reviewId, reply);
    return res.status(200).json({
      success: true,
      message: "Reply posted successfully",
      data,
    });
  } catch (error) {
    console.error("Reply Review Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reply to review",
    });
  }
};

export const getEligibleToReview = async (req, res) => {
  try {
    const data = await reviewService.getEligibleToReview(req.user);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Eligible Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch eligible review targets",
    });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const data = await reviewService.getReviewById(reviewId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Review By ID Error:", error);
    return res.status(404).json({
      success: false,
      message: error.message || "Review not found",
    });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const data = await reviewService.updateReview(req.user, reviewId, req.body);
    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update Review Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update review",
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const data = await reviewService.deleteReview(req.user, reviewId);
    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data,
    });
  } catch (error) {
    console.error("Delete Review Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete review",
    });
  }
};

