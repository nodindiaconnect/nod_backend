import prisma from "../config/prismaClient.js";

class ReviewService {
  /**
   * Submit a new review
   * Scoped to awardId to prevent cross-role score bleeding and duplicate reviews
   */
  async createReview(reviewerUser, data) {
    const {
      projectId,
      revieweeId,
      awardId: providedAwardId,
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
        awards: {
          include: {
            bid: true,
            contract: { include: { milestones: true } },
          },
        },
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

    // Resolve target award
    let targetAward = null;
    if (providedAwardId) {
      targetAward = project.awards.find((a) => a.id === providedAwardId);
    } else {
      targetAward = project.awards.find(
        (a) =>
          a.bid?.professionalId === revieweeId ||
          a.bid?.architect?.userId === revieweeId ||
          a.bid?.designer?.userId === revieweeId ||
          a.bid?.contractor?.userId === revieweeId ||
          (role && a.role === role)
      );
    }

    const awardId = targetAward ? targetAward.id : null;

    // Check if review already exists for this award or reviewer/reviewee
    if (awardId) {
      const existingAwardReview = await prisma.review.findUnique({
        where: { awardId },
      });
      if (existingAwardReview) {
        throw new Error("A review has already been submitted for this award");
      }
    }

    const existingUserReview = await prisma.review.findUnique({
      where: {
        projectId_reviewerId_revieweeId: {
          projectId,
          reviewerId: reviewerUser.id,
          revieweeId,
        },
      },
    });

    if (existingUserReview) {
      throw new Error("You have already submitted a review for this member on this project");
    }

    // Determine role of reviewee
    let revieweeRole = role;
    if (!revieweeRole && targetAward) {
      revieweeRole = targetAward.role;
    }
    if (!revieweeRole) {
      const member = project.teamMembers.find((m) => m.userId === revieweeId);
      if (member) revieweeRole = member.role;
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        projectId,
        awardId: awardId || undefined,
        reviewerId: reviewerUser.id,
        revieweeId,
        rating: numRating,
        qualityRating: qualityRating ? Number(qualityRating) : null,
        communicationRating: communicationRating
          ? Number(communicationRating)
          : null,
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

    // Update aggregate rating for reviewee per role
    await this.updateUserAggregateRatings(revieweeId);

    return review;
  }

  /**
   * Recalculate average ratings and total reviews for a user per role independently
   * (Ensures Architect score never bleeds into Contractor or Designer score)
   */
  async updateUserAggregateRatings(userId) {
    const [allStats, archStats, contStats, desStats] = await Promise.all([
      prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.review.aggregate({
        where: { revieweeId: userId, role: "ARCHITECT" },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.review.aggregate({
        where: { revieweeId: userId, role: "CONTRACTOR" },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.review.aggregate({
        where: { revieweeId: userId, role: "INTERIOR_DESIGNER" },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const globalAvg = allStats._avg.rating ? Number(allStats._avg.rating.toFixed(2)) : 0;
    const archAvg = archStats._avg.rating ? Number(archStats._avg.rating.toFixed(2)) : 0;
    const contAvg = contStats._avg.rating ? Number(contStats._avg.rating.toFixed(2)) : 0;
    const desAvg = desStats._avg.rating ? Number(desStats._avg.rating.toFixed(2)) : 0;

    const ratingStats = {
      architect: { rating: archAvg, totalReviews: archStats._count.id || 0 },
      contractor: { rating: contAvg, totalReviews: contStats._count.id || 0 },
      designer: { rating: desAvg, totalReviews: desStats._count.id || 0 },
      global: { rating: globalAvg, totalReviews: allStats._count.id || 0 },
    };

    // Update User model cache
    await prisma.user.update({
      where: { id: userId },
      data: {
        ratingCache: globalAvg,
        ratingStats,
      },
    });

    // Update individual profile tables with role-isolated scores
    if (archStats._count.id > 0) {
      await prisma.architect.updateMany({
        where: { userId },
        data: { rating: archAvg, totalReviews: archStats._count.id },
      });
    }

    if (contStats._count.id > 0) {
      await prisma.contractor.updateMany({
        where: { userId },
        data: { rating: contAvg, totalReviews: contStats._count.id },
      });
    }

    if (desStats._count.id > 0) {
      await prisma.designer.updateMany({
        where: { userId },
        data: { rating: desAvg, totalReviews: desStats._count.id },
      });
    }
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
      ...(query.rating && {
        rating: {
          gte: parseFloat(query.rating),
          lt: parseFloat(query.rating) + 1,
        },
      }),
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
      reviews: reviews.map((r) => this.formatReview(r)),
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
    let sumQuality = 0,
      countQuality = 0;
    let sumComm = 0,
      countComm = 0;
    let sumTime = 0,
      countTime = 0;
    let sumBudget = 0,
      countBudget = 0;

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
        quality: countQuality
          ? parseFloat((sumQuality / countQuality).toFixed(1))
          : 0,
        communication: countComm
          ? parseFloat((sumComm / countComm).toFixed(1))
          : 0,
        timeliness: countTime
          ? parseFloat((sumTime / countTime).toFixed(1))
          : 0,
        budget: countBudget
          ? parseFloat((sumBudget / countBudget).toFixed(1))
          : 0,
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

    const formatted = reviews.map((r) => this.formatReview(r));
    return formatted;
  }

  formatReview(review) {
    if (!review) return review;
    const reviewerProfileImg =
      typeof review.reviewer?.profile === "string" &&
      (review.reviewer.profile.startsWith("http") || review.reviewer.profile.startsWith("/uploads"))
        ? review.reviewer.profile
        : null;

    const revieweeProfileImg =
      typeof review.reviewee?.profile === "string" &&
      (review.reviewee.profile.startsWith("http") || review.reviewee.profile.startsWith("/uploads"))
        ? review.reviewee.profile
        : null;

    return {
      ...review,
      reviewer: review.reviewer
        ? { ...review.reviewer, profileImageUrl: reviewerProfileImg }
        : review.reviewer,
      reviewee: review.reviewee
        ? { ...review.reviewee, profileImageUrl: revieweeProfileImg }
        : review.reviewee,
    };
  }

  /**
   * Get all reviews, given reviews, and pending review eligibility for current user
   */
  async getMyReviews(user, query = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));

    // Reviews received
    const userReviewsRes = await this.getReviewsForUser(user.id, {
      page,
      limit,
    });

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
      given: givenReviews.map((r) => this.formatReview(r)),
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
            teamMembers: {
              where: { status: "ACTIVE" },
              include: { user: true },
            },
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

    // Process team projects: specialist can review the client AND other team members
    teamProjects.forEach((tp) => {
      const proj = tp.project;
      if (proj) {
        const reviewedUserIds = new Set(proj.reviews.map((r) => r.revieweeId));

        // Can review the project client / owner
        if (
          proj.clientId !== user.id &&
          !reviewedUserIds.has(proj.clientId) &&
          proj.client
        ) {
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

        // Can review fellow team members on the same project
        if (Array.isArray(proj.teamMembers)) {
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
        }
      }
    });

    return eligible;
  }

  /**
   * Fetch a single review by its ID
   */
  async getReviewById(reviewId) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
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

    if (!review) {
      throw new Error("Review not found");
    }

    return review;
  }

  /**
   * Update an existing review by its reviewer
   */
  async updateReview(reviewerUser, reviewId, data) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error("Review not found");
    }

    if (review.reviewerId !== reviewerUser.id) {
      throw new Error("You are not authorized to edit this review");
    }

    const {
      rating,
      qualityRating,
      communicationRating,
      timelinessRating,
      budgetRating,
      title,
      comment,
      photos,
    } = data;

    const updateData = {};

    if (rating !== undefined) {
      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        throw new Error("Rating must be a number between 1 and 5");
      }
      updateData.rating = numRating;
    }

    if (qualityRating !== undefined) {
      updateData.qualityRating = qualityRating ? Number(qualityRating) : null;
    }
    if (communicationRating !== undefined) {
      updateData.communicationRating = communicationRating
        ? Number(communicationRating)
        : null;
    }
    if (timelinessRating !== undefined) {
      updateData.timelinessRating = timelinessRating
        ? Number(timelinessRating)
        : null;
    }
    if (budgetRating !== undefined) {
      updateData.budgetRating = budgetRating ? Number(budgetRating) : null;
    }
    if (title !== undefined) {
      updateData.title = title ? title.trim() : null;
    }
    if (comment !== undefined) {
      if (!comment || comment.trim().length < 5) {
        throw new Error("Review comment must be at least 5 characters");
      }
      updateData.comment = comment.trim();
    }
    if (photos !== undefined) {
      updateData.photos = Array.isArray(photos) ? photos : [];
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: updateData,
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

    // Recalculate aggregate ratings
    await this.updateUserAggregateRatings(review.revieweeId);

    return updated;
  }

  /**
   * Delete a review by reviewer or admin
   */
  async deleteReview(reviewerUser, reviewId) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error("Review not found");
    }

    const isAdmin = reviewerUser.role === 0 || reviewerUser.isAdmin;
    if (review.reviewerId !== reviewerUser.id && !isAdmin) {
      throw new Error("You are not authorized to delete this review");
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    // Recalculate aggregate ratings for reviewee
    await this.updateUserAggregateRatings(review.revieweeId);

    return { success: true, id: reviewId };
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
