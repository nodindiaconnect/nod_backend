import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

class PostController {

    static async createPost(req, res) {
        try {
            const userId = req.user.id;
            const { title, description, images } = req.body;

            if (!title || !description || !images?.length) {
                return helper.failed(res, "Title, description, and at least one image are required");
            }

            const post = await prisma.post.create({
                data: { userId, title, description, images },
            });

            return helper.success(res, "Post created successfully", post);
        } catch (error) {
            return helper.err(res, error, "/post/create");
        }
    }

    static async getPostById(req, res) {
        try {
            const { postId } = req.params;

            const post = await prisma.post.findUnique({
                where: { id: postId },
                include: { user: { select: { id: true, name: true, role: true } } },
            });

            if (!post) return helper.failed(res, "Post not found", {}, 404);

            return helper.success(res, "Post fetched successfully", post);
        } catch (error) {
            return helper.err(res, error, "/post/get");
        }
    }

    static async updatePost(req, res) {
        try {
            const userId = req.user.id;
            const { postId } = req.params;
            const { title, description, images } = req.body;

            const post = await prisma.post.findUnique({ where: { id: postId } });
            if (!post) return helper.failed(res, "Post not found", {}, 404);
            if (post.userId !== userId) return helper.failed(res, "Not authorized to edit this post", {}, 403);

            const updated = await prisma.post.update({
                where: { id: postId },
                data: {
                    ...(title !== undefined && { title }),
                    ...(description !== undefined && { description }),
                    ...(images !== undefined && { images }),
                },
            });

            return helper.success(res, "Post updated successfully", updated);
        } catch (error) {
            return helper.err(res, error, "/post/update");
        }
    }

    static async deletePost(req, res) {
        try {
            const userId = req.user.id;
            const { postId } = req.params;

            const post = await prisma.post.findUnique({ where: { id: postId } });
            if (!post) return helper.failed(res, "Post not found", {}, 404);
            if (post.userId !== userId) return helper.failed(res, "Not authorized to delete this post", {}, 403);

            await prisma.post.delete({ where: { id: postId } });

            return helper.success(res, "Post deleted successfully");
        } catch (error) {
            return helper.err(res, error, "/post/delete");
        }
    }


    static async getAllPortfolios(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const whereCondition = {
                isDeleted: false,
                // isActive: true,
                isBlocked: false,
                role: { in: [2, 3, 4] },
            };

            const totalRecords = await prisma.user.count({
                where: whereCondition,
            });

            const users = await prisma.user.findMany({
                where: whereCondition,
                select: {
                    id: true,
                    name: true,
                    username: true,
                    profile: true,
                    role: true,
                    country: true,
                    state: true,
                    city: true,
                    createdAt: true,
                    posts: {
                        orderBy: { createdAt: "desc" },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            images: true,
                            createdAt: true,
                        },
                    },
                    followers: {
                        where: {
                            follower: {
                                isDeleted: false,
                                isActive: true,
                                isBlocked: false,
                            },
                        },
                        select: {
                            createdAt: true,
                            follower: {
                                select: {
                                    id: true,
                                    name: true,
                                    username: true,
                                    profile: true,
                                    role: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            posts: true,
                            followers: true,
                            following: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: [
                    { posts: { _count: "desc" } },
                    { createdAt: "desc" },
                ],
            });

            return helper.success(res, "Portfolios fetched successfully", {
                data: users,
                pagination: {
                    currentPage: page,
                    perPage: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    hasNextPage: page < Math.ceil(totalRecords / limit),
                    hasPreviousPage: page > 1,
                },
            });
        } catch (error) {
            return helper.err(res, error, "/post/portfolios");
        }
    }


    static async getUserPortfolioWithPagination(req, res) {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            if (!userId) {
                return helper.failed(res, "User ID is required");
            }

            const posts = await prisma.post.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            });

            const totalCount = await prisma.post.count({ where: { userId } });
            const totalPages = Math.ceil(totalCount / limit) || 1;

            return helper.success(res, "Posts fetched successfully", {
                posts,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalPosts: totalCount,
                    perPage: limit,
                },
            });
        } catch (error) {
            return helper.err(res, error, "/post/user-portfolio-paginated");
        }
    }
    static async getUserPortfolio(req, res) {
        try {
            const { userId } = req.params;

            const posts = await prisma.post.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
            });

            return helper.success(res, "Portfolio fetched successfully", posts);
        } catch (error) {
            return helper.err(res, error, "/post/portfolio");
        }
    }

    static async getHomeFeed(req, res) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const following = await prisma.follow.findMany({
                where: { followerId: userId },
                select: { followingId: true },
            });
            const followingIds = following.map((f) => f.followingId);

            if (!followingIds.length) {
                return helper.success(res, "Feed fetched successfully", []);
            }

            const posts = await prisma.post.findMany({
                where: { userId: { in: followingIds } },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: { user: { select: { id: true, name: true, role: true } } },
            });

            return helper.success(res, "Feed fetched successfully", posts);
        } catch (error) {
            return helper.err(res, error, "/post/feed");
        }
    }



    static async getAllPortfoliosByRole(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const roleNum = Number(req.query.role);

            const ALLOWED_ROLES = [2, 3, 4]; // designer, architect, contractor

            if (!Number.isInteger(roleNum) || !ALLOWED_ROLES.includes(roleNum)) {
                return helper.failed(res, "Invalid role. Must be 2 (designer), 3 (architect), or 4 (contractor).");
            }

            const users = await prisma.user.findMany({
                where: {
                    isDeleted: false,
                    isBlocked: false,
                    role: roleNum,
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    profile: true,
                    role: true,
                    country: true,
                    state: true,
                    city: true,
                    createdAt: true,
                    posts: {
                        orderBy: { createdAt: "desc" },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            images: true,
                            createdAt: true,
                        },
                    },
                    followers: {
                        where: {
                            follower: {
                                isDeleted: false,
                                isActive: true,
                                isBlocked: false,
                            },
                        },
                        select: {
                            createdAt: true,
                            follower: {
                                select: {
                                    id: true,
                                    name: true,
                                    username: true,
                                    profile: true,
                                    role: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            posts: true,
                            followers: true,
                            following: true,
                        },
                    },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [
                    { posts: { _count: "desc" } },
                    { createdAt: "desc" },
                ],
            });

            const totalCount = await prisma.user.count({
                where: { isDeleted: false, isBlocked: false, role: roleNum },
            });
            const totalPages = Math.ceil(totalCount / limit) || 1;

            return helper.success(res, "Portfolios fetched successfully", {
                users,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers: totalCount,
                    perPage: limit,
                },
            });
        } catch (error) {
            return helper.err(res, error, "/post/portfolios-by-role");
        }
    }

}

export default PostController;