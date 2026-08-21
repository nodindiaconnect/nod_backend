import prisma from "../prisma/prisma.js";

class ReviewService {
  /**
   * Submit a new review
   */
  async createReview(reviewerUser, data) {
    const {
      projectId,
      revieweeId,
      rating,
      qualityRating,
      communicationRating,
      timelinessRating,
      budgetRating,
      title,
      comment,
      role,
      photos = [],
    } = data;

    if (!projectId || !revieweeId) {
      throw new Error("Project ID and Reviewee ID are required");
    }

    if (reviewerUser.id === revieweeId) {
      throw new Error("You cannot review yourself");
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }

    if (!comment || comment.trim().length < 5) {
      throw new Error("Review comment must be at least 5 characters");
    }

    // Check project exists and verify eligibility
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        teamMembers: {
          where: { status: "ACTIVE" },
          include: { user: true },
        },
        client: true,
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const isReviewerClient = project.clientId === reviewerUser.id;
    const isReviewerTeam = project.teamMembers.some((m) => m.userId === reviewerUser.id);

    if (!isReviewerClient && !isReviewerTeam) {
      throw new Error("You are not a participant in this project");
    }

    const isRevieweeClient = project.clientId === revieweeId;
    const isRevieweeTeam = project.teamMembers.some((m) => m.userId === revieweeId);

    if (!isRevieweeClient && !isRevieweeTeam) {
      throw new Error("The person you are reviewing is not a participant in this project");
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        projectId_reviewerId_revieweeId: {
          projectId,
          reviewerId: reviewerUser.id,
          revieweeId,
        },
      },
    });

    if (existingReview) {
      throw new Error("You have already submitted a review for this member on this project");
    }

    // Determine role of reviewee if not provided
    let revieweeRole = role;
    if (!revieweeRole) {
      const member = project.teamMembers.find((m) => m.userId === revieweeId);
      if (member) revieweeRole = member.role;
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        projectId,
        reviewerId: reviewerUser.id,
        revieweeId,
        rating: numRating,
        qualityRating: qualityRating ? Number(qualityRating) : null,
        communicationRating: communicationRating ? Number(communicationRating) : null,
        timelinessRating: timelinessRating ? Number(timelinessRating) : null,
        budgetRating: budgetRating ? Number(budgetRating) : null,
        title: title ? title.trim() : null,
        comment: comment.trim(),
        role: revieweeRole || null,
        photos: Array.isArray(photos) ? photos : [],
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            category: true,
            city: true,
            state: true,
          },
        },
      },
    });

    // Update aggregate rating for reviewee
    await this.updateUserAggregateRatings(revieweeId);

    return review;
  }

  /**
   * Recalculate average ratings and total reviews for a user/specialist
   */
  async updateUserAggregateRatings(userId) {
    const stats = await prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    const avgRating = stats._avg.rating ? Number(stats._avg.rating.toFixed(2)) : 0;
    const totalReviews = stats._count.id || 0;

    // Update Architect, Contractor, and Designer if they exist
    await prisma.architect.updateMany({
      where: { userId },
      data: { rating: avgRating, totalReviews },
    });

    await prisma.contractor.updateMany({
      where: { userId },
      data: { rating: avgRating, totalReviews },
    });

    await prisma.designer.updateMany({
      where: { userId },
      data: { rating: avgRating, totalReviews },
    });
  }

  /**
   * Get reviews for a specific user with full breakdown stats
   */
  async getReviewsForUser(userId, query = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = {
      revieweeId: userId,
      ...(query.rating && { rating: { gte: parseFloat(query.rating), lt: parseFloat(query.rating) + 1 } }),
      ...(query.role && { role: query.role }),
    };

    const [reviews, totalCount, allUserReviews] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              role: true,
              profile: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              category: true,
              city: true,
              state: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.findMany({
        where: { revieweeId: userId },
        select: {
          rating: true,
          qualityRating: true,
          communicationRating: true,
          timelinessRating: true,
          budgetRating: true,
        },
      }),
    ]);

    const summary = this.computeRatingBreakdown(allUserReviews);

    return {
      reviews,
      summary,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Compute comprehensive rating breakdown metrics
   */
  computeRatingBreakdown(reviewsList) {
    const total = reviewsList.length;
    if (total === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        distributionPercentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        categories: {
          quality: 0,
          communication: 0,
          timeliness: 0,
          budget: 0,
        },
      };
    }

    let sumTotal = 0;
    let sumQuality = 0, countQuality = 0;
    let sumComm = 0, countComm = 0;
    let sumTime = 0, countTime = 0;
    let sumBudget = 0, countBudget = 0;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviewsList.forEach((r) => {
      sumTotal += r.rating;
      const roundedStar = Math.min(5, Math.max(1, Math.round(r.rating)));
      distribution[roundedStar] = (distribution[roundedStar] || 0) + 1;

      if (r.qualityRating) {
        sumQuality += r.qualityRating;
        countQuality++;
      }
      if (r.communicationRating) {
        sumComm += r.communicationRating;
        countComm++;
      }
      if (r.timelinessRating) {
        sumTime += r.timelinessRating;
        countTime++;
      }
      if (r.budgetRating) {
        sumBudget += r.budgetRating;
        countBudget++;
      }
    });

    const distributionPercentages = {
      5: Math.round((distribution[5] / total) * 100),
      4: Math.round((distribution[4] / total) * 100),
      3: Math.round((distribution[3] / total) * 100),
      2: Math.round((distribution[2] / total) * 100),
      1: Math.round((distribution[1] / total) * 100),
    };

    return {
      averageRating: parseFloat((sumTotal / total).toFixed(1)),
      totalReviews: total,
      distribution,
      distributionPercentages,
      categories: {
        quality: countQuality ? parseFloat((sumQuality / countQuality).toFixed(1)) : 0,
        communication: countComm ? parseFloat((sumComm / countComm).toFixed(1)) : 0,
        timeliness: countTime ? parseFloat((sumTime / countTime).toFixed(1)) : 0,
        budget: countBudget ? parseFloat((sumBudget / countBudget).toFixed(1)) : 0,
      },
    };
  }

  /**
   * Get reviews for a specific project
   */
  async getReviewsForProject(projectId) {
    const reviews = await prisma.review.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
      },
    });

    return reviews;
  }

  /**
   * Get all reviews, given reviews, and pending review eligibility for current user
   */
  async getMyReviews(user, query = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));

    // Reviews received
    const userReviewsRes = await this.getReviewsForUser(user.id, { page, limit });

    // Reviews given by user
    const givenReviews = await prisma.review.findMany({
      where: { reviewerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        reviewee: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            category: true,
            city: true,
            state: true,
          },
        },
      },
    });

    // Find projects & members eligible to review
    const eligibleToReview = await this.getEligibleToReview(user);

    return {
      received: userReviewsRes.reviews,
      summary: userReviewsRes.summary,
      pagination: userReviewsRes.pagination,
      given: givenReviews,
      eligible: eligibleToReview,
    };
  }

  /**
   * Get project members that the current user has worked with but not reviewed yet
   */
  async getEligibleToReview(user) {
    // 1. Projects where user is client
    const clientProjects = await prisma.project.findMany({
      where: {
        clientId: user.id,
        status: { in: ["SELECTED", "IN_PROGRESS", "COMPLETED"] },
      },
      include: {
        teamMembers: {
          where: { status: "ACTIVE" },
          include: { user: true },
        },
        reviews: {
          where: { reviewerId: user.id },
        },
      },
    });

    // 2. Projects where user is a team member
    const teamProjects = await prisma.projectTeam.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      include: {
        project: {
          include: {
            client: true,
            reviews: {
              where: { reviewerId: user.id },
            },
          },
        },
      },
    });

    const eligible = [];

    // Process client projects: client can review each hired team member
    clientProjects.forEach((proj) => {
      const reviewedUserIds = new Set(proj.reviews.map((r) => r.revieweeId));
      proj.teamMembers.forEach((tm) => {
        if (tm.userId !== user.id && !reviewedUserIds.has(tm.userId)) {
          eligible.push({
            projectId: proj.id,
            projectTitle: proj.title,
            projectCategory: proj.category,
            revieweeId: tm.userId,
            revieweeName: tm.user?.name || "Specialist",
            revieweeRole: tm.role,
            revieweeProfile: tm.user?.profile,
          });
        }
      });
    });

    // Process team projects: specialist can review the client
    teamProjects.forEach((tp) => {
      const proj = tp.project;
      if (proj) {
        const hasReviewedClient = proj.reviews.some((r) => r.revieweeId === proj.clientId);
        if (!hasReviewedClient && proj.client) {
          eligible.push({
            projectId: proj.id,
            projectTitle: proj.title,
            projectCategory: proj.category,
            revieweeId: proj.clientId,
            revieweeName: proj.client.name,
            revieweeRole: "CLIENT",
            revieweeProfile: proj.client.profile,
          });
        }
      }
    });

    return eligible;
  }

  /**
   * Post a reply to a review (for the reviewee)
   */
  async replyToReview(user, reviewId, replyText) {
    if (!replyText || !replyText.trim()) {
      throw new Error("Reply message cannot be empty");
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error("Review not found");
    }

    if (review.revieweeId !== user.id) {
      throw new Error("Only the recipient of this review can reply");
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        reply: replyText.trim(),
        repliedAt: new Date(),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return updated;
  }
}

export default new ReviewService();
