import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

class FollowController {
  static async followUser(req, res) {
    try {
      const followerId = req.user.id;
      const { userId: followingId } = req.params;

      if (followerId === followingId) {
        return helper.failed(res, "You cannot follow yourself");
      }

      const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
      if (!targetUser) return helper.failed(res, "User not found", {}, 404);

      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      });
      if (existing) return helper.failed(res, "Already following this user", {}, 409);

      const follow = await prisma.follow.create({
        data: { followerId, followingId },
      });

      return helper.success(res, "Followed successfully", follow);
    } catch (error) {
      return helper.err(res, error, "/follow/follow");
    }
  }

  static async unfollowUser(req, res) {
    try {
      const followerId = req.user.id;
      const { userId: followingId } = req.params;

      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      });
      if (!existing) return helper.failed(res, "You are not following this user", {}, 404);

      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });

      return helper.success(res, "Unfollowed successfully");
    } catch (error) {
      return helper.err(res, error, "/follow/unfollow");
    }
  }

  static async getFollowers(req, res) {
    try {
      const { userId } = req.params;

      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, name: true, role: true } } },
      });

      return helper.success(res, "Followers fetched successfully", followers.map((f) => f.follower));
    } catch (error) {
      return helper.err(res, error, "/follow/followers");
    }
  }

  static async getFollowing(req, res) {
    try {
      const { userId } = req.params;

      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, name: true, role: true } } },
      });

      return helper.success(res, "Following list fetched successfully", following.map((f) => f.following));
    } catch (error) {
      return helper.err(res, error, "/follow/following");
    }
  }
}

export default FollowController;