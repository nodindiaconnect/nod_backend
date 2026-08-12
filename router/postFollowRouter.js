
import express from "express";
import PostController from "../controllers/postController.js";
import FollowController from "../controllers/followController.js";
import { Auth } from "../middleware/authenticate.js";

const router = express.Router();

// Post routes
router.post("/post/create", Auth, PostController.createPost);
router.get("/post/:postId", PostController.getPostById);
router.put("/post/:postId", Auth, PostController.updatePost);
router.delete("/post/:postId", Auth, PostController.deletePost);

// Portfolio routes
router.get("/all", PostController.getAllPortfolios);
router.get("/all/by-role", PostController.getAllPortfoliosByRole);
router.get("/:userId/posts-paginated", PostController.getUserPortfolioWithPagination);
router.get("/:userId", PostController.getUserPortfolio)

// Feed route
router.get("/feed", Auth, PostController.getHomeFeed);

// Follow routes
router.post("/follow/:userId", Auth, FollowController.followUser);
router.delete("/follow/:userId", Auth, FollowController.unfollowUser);
router.get("/follow/:userId/followers", FollowController.getFollowers);
router.get("/follow/:userId/following", FollowController.getFollowing);

export default router;