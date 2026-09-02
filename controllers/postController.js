import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

function safeJsonParse(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val) || fallback;
  } catch {
    return fallback;
  }
}

function formatPortfolioUser(user) {
  if (!user) return null;

  const rawProfile = safeJsonParse(user.profile, {});
  const roleNum = Number(user.role);

  let category = user.category || null;
  let specialization = user.specialization || null;
  let specializations = [];
  let bio = rawProfile.bio || null;
  let experience = rawProfile.experience !== undefined ? Number(rawProfile.experience) : null;
  let experienceLevel = null;
  let rating = user.ratingCache ?? 0;
  let totalReviews = user._count?.reviewsReceived ?? 0;
  let style = rawProfile.style || null;
  let designStyles = [];
  let rate = rawProfile.rate !== undefined ? Number(rawProfile.rate) : null;
  let software = rawProfile.software || null;
  let licenseNumber = null;
  let trade = rawProfile.trade || null;
  let workTypes = [];
  let teamSize = null;
  let gstNumber = null;
  let businessName = rawProfile.businessName || null;
  let ownerName = rawProfile.ownerName || null;
  let businessType = rawProfile.businessType || null;
  let serviceCities = [];
  let certifications = [];
  let portfolioLinks = [];
  let photos = [];

  if (roleNum === 2) {
    // ── DESIGNER ──
    const d = user.designer || {};
    category = d.category || user.category || rawProfile.category || "Interior Design";
    specializations = Array.isArray(d.specializations)
      ? d.specializations
      : typeof d.specializations === "string"
        ? safeJsonParse(d.specializations, [])
        : [];
    specialization = specializations[0] || user.specialization || rawProfile.specialization || "Interior Designer";
    designStyles = Array.isArray(d.designStyles)
      ? d.designStyles
      : typeof d.designStyles === "string"
        ? safeJsonParse(d.designStyles, [])
        : [];
    style = designStyles[0] || rawProfile.style || null;
    bio = d.bio || rawProfile.bio || null;
    if (d.yearsOfExperience !== undefined && d.yearsOfExperience !== null) {
      experience = Number(d.yearsOfExperience);
    }
    experienceLevel = d.experienceLevel || (experience >= 8 ? "EXPERT" : experience >= 4 ? "ADVANCED" : experience >= 2 ? "INTERMEDIATE" : "BEGINNER");
    if (d.rating) rating = Number(d.rating);
    if (d.totalReviews) totalReviews = Number(d.totalReviews);
    serviceCities = Array.isArray(d.serviceCities) ? d.serviceCities : safeJsonParse(d.serviceCities, []);
    portfolioLinks = Array.isArray(d.portfolioLinks) ? d.portfolioLinks : safeJsonParse(d.portfolioLinks, []);
    photos = Array.isArray(d.photos) ? d.photos : safeJsonParse(d.photos, []);
  } else if (roleNum === 3) {
    // ── ARCHITECT ──
    const a = user.architect || {};
    category = "Architecture";
    specializations = typeof a.specializations === "string"
      ? safeJsonParse(a.specializations, [])
      : Array.isArray(a.specializations)
        ? a.specializations
        : [];
    specialization = specializations[0] || user.specialization || rawProfile.specialization || "Architectural Design";
    certifications = typeof a.certifications === "string"
      ? safeJsonParse(a.certifications, [])
      : Array.isArray(a.certifications)
        ? a.certifications
        : [];
    software = certifications[0] || rawProfile.software || "AutoCAD";
    bio = a.bio || rawProfile.bio || null;
    if (a.yearsOfExperience !== undefined && a.yearsOfExperience !== null) {
      experience = Number(a.yearsOfExperience);
    }
    experienceLevel = a.experienceLevel || (experience >= 8 ? "EXPERT" : experience >= 4 ? "ADVANCED" : experience >= 2 ? "INTERMEDIATE" : "BEGINNER");
    licenseNumber = a.licenseNumber || null;
    if (a.rating) rating = Number(a.rating);
    if (a.totalReviews) totalReviews = Number(a.totalReviews);
    serviceCities = typeof a.serviceCities === "string" ? safeJsonParse(a.serviceCities, []) : (a.serviceCities || []);
    portfolioLinks = typeof a.portfolioLinks === "string" ? safeJsonParse(a.portfolioLinks, []) : (a.portfolioLinks || []);
  } else if (roleNum === 4) {
    // ── CONTRACTOR ──
    const c = user.contractor || {};
    category = "Construction & Contracting";
    workTypes = typeof c.workTypes === "string"
      ? safeJsonParse(c.workTypes, [])
      : Array.isArray(c.workTypes)
        ? c.workTypes
        : [];
    trade = workTypes[0] || rawProfile.trade || "General Contractor";
    specialization = trade;
    specializations = workTypes;
    bio = c.bio || rawProfile.bio || null;
    if (c.yearsOfExperience !== undefined && c.yearsOfExperience !== null) {
      experience = Number(c.yearsOfExperience);
    }
    experienceLevel = c.experienceLevel || (experience >= 8 ? "EXPERT" : experience >= 4 ? "ADVANCED" : experience >= 2 ? "INTERMEDIATE" : "BEGINNER");
    teamSize = c.teamSize ?? null;
    licenseNumber = c.licenseNumber || null;
    gstNumber = c.gstNumber || null;
    if (c.rating) rating = Number(c.rating);
    if (c.totalReviews) totalReviews = Number(c.totalReviews);
    serviceCities = typeof c.serviceCities === "string" ? safeJsonParse(c.serviceCities, []) : (c.serviceCities || []);
    portfolioLinks = typeof c.portfolioLinks === "string" ? safeJsonParse(c.portfolioLinks, []) : (c.portfolioLinks || []);
  } else if (roleNum === 5) {
    // ── MATERIAL SUPPLIER ──
    const s = user.contactDetails || {};
    businessName = s.shopName || rawProfile.businessName || user.name || "Building Material Supplier";
    ownerName = rawProfile.ownerName || user.name;
    businessType = rawProfile.businessType || "Material Supplier";
    category = "Material Supply";
    specialization = businessType;
    specializations = [businessType];
    bio = rawProfile.bio || "Authorized supplier of quality architectural & construction materials";
  }

  // Synthesize unified profile object
  const unifiedProfile = {
    ...rawProfile,
    bio,
    category,
    specialization,
    specializations,
    experience,
    experienceLevel,
    rating,
    totalReviews,
    ...(style && { style }),
    ...(designStyles.length > 0 && { designStyles }),
    ...(rate !== null && { rate }),
    ...(software && { software }),
    ...(certifications.length > 0 && { certifications }),
    ...(trade && { trade }),
    ...(workTypes.length > 0 && { workTypes }),
    ...(teamSize !== null && { teamSize }),
    ...(licenseNumber && { licenseNumber }),
    ...(gstNumber && { gstNumber }),
    ...(businessName && { businessName }),
    ...(ownerName && { ownerName }),
    ...(businessType && { businessType }),
    ...(serviceCities.length > 0 && { serviceCities }),
    ...(portfolioLinks.length > 0 && { portfolioLinks }),
    ...(photos.length > 0 && { photos }),
  };

  const locationParts = [user.city, user.state, user.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : "India";
  const roleNameMap = {
    1: "Client",
    2: "Interior Designer",
    3: "Architect",
    4: "Contractor",
    5: "Material Supplier",
  };

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    roleName: roleNameMap[roleNum] || "Professional",
    country: user.country,
    state: user.state,
    city: user.city,
    address: user.address,
    location: locationStr,
    category,
    specialization,
    specializations,
    experience: experience ?? 2,
    experienceYears: experience ?? 2,
    rating: rating || 0,
    totalReviews: totalReviews || 0,
    ratingCache: user.ratingCache ?? rating ?? 0,
    ratingStats: user.ratingStats || null,
    profile: unifiedProfile,
    createdAt: user.createdAt,
    registeredDate: user.registeredDate,
    posts: user.posts || [],
    followers: user.followers || [],
    designer: user.designer || null,
    architect: user.architect || null,
    contractor: user.contractor || null,
    contactDetails: user.contactDetails || null,
    _count: user._count || {
      posts: user.posts?.length || 0,
      followers: user.followers?.length || 0,
      following: 0,
      products: 0,
    },
  };
}

const PORTFOLIO_SELECT_FIELDS = {
  id: true,
  name: true,
  username: true,
  profile: true,
  role: true,
  country: true,
  state: true,
  city: true,
  address: true,
  specialization: true,
  category: true,
  ratingCache: true,
  ratingStats: true,
  registeredDate: true,
  createdAt: true,
  designer: {
    select: {
      id: true,
      bio: true,
      category: true,
      specializations: true,
      designStyles: true,
      yearsOfExperience: true,
      experienceLevel: true,
      photos: true,
      portfolioLinks: true,
      serviceCities: true,
      rating: true,
      totalReviews: true,
    },
  },
  architect: {
    select: {
      id: true,
      bio: true,
      yearsOfExperience: true,
      experienceLevel: true,
      specializations: true,
      licenseNumber: true,
      certifications: true,
      portfolioLinks: true,
      serviceCities: true,
      rating: true,
      totalReviews: true,
    },
  },
  contractor: {
    select: {
      id: true,
      bio: true,
      yearsOfExperience: true,
      experienceLevel: true,
      workTypes: true,
      teamSize: true,
      licenseNumber: true,
      gstNumber: true,
      certifications: true,
      portfolioLinks: true,
      serviceCities: true,
      rating: true,
      totalReviews: true,
    },
  },
  contactDetails: {
    select: {
      id: true,
      shopName: true,
      address: true,
      city: true,
      state: true,
      country: true,
      whatsappNumber: true,
      callNumber: true,
      email: true,
    },
  },
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
      reviewsReceived: true,
      products: true,
    },
  },
};

class PostController {
  static async createPost(req, res) {
    try {
      const userId = req.user.id;
      const { title, description, images } = req.body;

      if (!title || !description || !images?.length) {
        return helper.failed(
          res,
          "Title, description, and at least one image are required",
        );
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
      if (post.userId !== userId)
        return helper.failed(res, "Not authorized to edit this post", {}, 403);

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
      if (post.userId !== userId)
        return helper.failed(
          res,
          "Not authorized to delete this post",
          {},
          403,
        );

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
      const roleParam = req.query.role;

      let roleFilter = { in: [2, 3, 4, 5] };
      if (roleParam && roleParam !== "ALL") {
        const num = Number(roleParam);
        if (Number.isInteger(num) && [2, 3, 4, 5].includes(num)) {
          roleFilter = num;
        }
      }

      const whereCondition = {
        isDeleted: false,
        isBlocked: false,
        role: roleFilter,
      };

      const totalRecords = await prisma.user.count({
        where: whereCondition,
      });

      const rawUsers = await prisma.user.findMany({
        where: whereCondition,
        select: PORTFOLIO_SELECT_FIELDS,
        skip,
        take: limit,
        orderBy: [{ posts: { _count: "desc" } }, { createdAt: "desc" }],
      });

      const formattedUsers = rawUsers.map(formatPortfolioUser);

      return helper.success(res, "Portfolios fetched successfully", {
        data: formattedUsers,
        users: formattedUsers,
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

      const [rawUser, posts] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: PORTFOLIO_SELECT_FIELDS,
        }),
        prisma.post.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      if (!rawUser) {
        return helper.failed(res, "User not found", {}, 404);
      }

      const user = formatPortfolioUser(rawUser);

      return helper.success(res, "Portfolio fetched successfully", {
        data: posts,
        posts,
        user,
      });
    } catch (error) {
      return helper.err(res, error, "/post/portfolio");
    }
  }

  /**
   * Get Public Professional Performance Metrics for Architects, Contractors, and Designers
   * Used by Recharts visual performance section
   */
  static async getUserPerformanceMetrics(req, res) {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          architect: true,
          contractor: true,
          designer: true,
          posts: {
            select: {
              id: true,
              title: true,
              description: true,
              images: true,
              createdAt: true,
            },
          },
          reviewsReceived: {
            include: {
              reviewer: {
                select: { id: true, name: true, profile: true, role: true },
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
            orderBy: { createdAt: "desc" },
          },
          bidsSubmitted: {
            include: {
              award: {
                include: {
                  contract: {
                    include: { milestones: true },
                  },
                  project: {
                    select: {
                      id: true,
                      title: true,
                      category: true,
                      status: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return helper.failed(res, "Professional not found", {}, 404);
      }

      const proRole =
        user.role === 3
          ? "ARCHITECT"
          : user.role === 4
            ? "CONTRACTOR"
            : "INTERIOR_DESIGNER";
      const specialist =
        user.architect || user.contractor || user.designer || {};

      // 1. Projects Completed & In Progress — only from real specialist stats + real bid/contract data
      const awardedBids = user.bidsSubmitted.filter((b) => b.award);
      const liveCompletedCount = awardedBids.filter((b) => {
        const contract = b.award?.contract;
        const milestones = contract?.milestones || [];
        return (
          milestones.length > 0 && milestones.every((m) => m.status === "PAID")
        );
      }).length;

      const liveInProgressCount = awardedBids.filter((b) => {
        const contract = b.award?.contract;
        return contract && contract.status === "ACTIVE";
      }).length;

      const completedProjects =
        (specialist.totalProjectsHandled || 0) + liveCompletedCount;
      const inProgressProjects =
        (specialist.projectsInProgress || 0) + liveInProgressCount;
      const totalProjectVol = completedProjects + inProgressProjects;
      const successRate =
        totalProjectVol > 0
          ? Math.min(
              100,
              Math.round((completedProjects / totalProjectVol) * 100),
            )
          : null;

      // 2. Client Ratings & Sub-metrics — only from real reviews, null if none exist
      const reviews = user.reviewsReceived || [];
      const reviewCount = reviews.length;

      const ratedReviews = reviews.filter((r) => r.rating != null);
      const avgRating =
        ratedReviews.length > 0
          ? Number(
              (
                ratedReviews.reduce((acc, r) => acc + r.rating, 0) /
                ratedReviews.length
              ).toFixed(1),
            )
          : user.ratingCache != null
            ? Number(user.ratingCache)
            : null;

      const avgOf = (field) => {
        const vals = reviews
          .filter((r) => r[field] != null)
          .map((r) => r[field]);
        return vals.length > 0
          ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
          : null;
      };

      const qualityScore = avgOf("qualityRating");
      const communicationScore = avgOf("communicationRating");
      const timelinessScore = avgOf("timelinessRating");
      const budgetScore = avgOf("budgetRating");

      // Rating Star Distribution — only real counts, no invented fallback totals
      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((r) => {
        if (r.rating == null) return;
        const star = Math.round(r.rating);
        if (distribution[star] !== undefined) distribution[star]++;
      });

      const distributionData =
        reviewCount > 0
          ? [
              {
                star: "5 Star",
                count: distribution[5],
                percentage: Math.round((distribution[5] / reviewCount) * 100),
              },
              {
                star: "4 Star",
                count: distribution[4],
                percentage: Math.round((distribution[4] / reviewCount) * 100),
              },
              {
                star: "3 Star",
                count: distribution[3],
                percentage: Math.round((distribution[3] / reviewCount) * 100),
              },
              {
                star: "2 Star",
                count: distribution[2],
                percentage: Math.round((distribution[2] / reviewCount) * 100),
              },
              {
                star: "1 Star",
                count: distribution[1],
                percentage: Math.round((distribution[1] / reviewCount) * 100),
              },
            ]
          : [];

      // 3. On-Time Completion & Response Rates — only if tracked on the specialist record; no invented constants
      const onTimeCompletionRate = specialist.onTimeCompletionRate ?? null;
      const responseRate = specialist.responseRate ?? null;

      // 4. Monthly Performance Timeline — only build from real milestone/contract dates, not a synthetic formula
      const monthlyMap = new Map();
      awardedBids.forEach((b) => {
        const milestones = b.award?.contract?.milestones || [];
        milestones
          .filter((m) => m.status === "PAID" && m.paidAt)
          .forEach((m) => {
            const d = new Date(m.paidAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleString("en-US", { month: "short" });
            if (!monthlyMap.has(key)) {
              monthlyMap.set(key, {
                month: label,
                completed: 0,
                deliverables: 0,
              });
            }
            monthlyMap.get(key).deliverables += 1;
          });
      });
      const monthlyRatingMap = new Map();
      reviews.forEach((r) => {
        if (r.rating == null || !r.createdAt) return;
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyRatingMap.has(key)) monthlyRatingMap.set(key, []);
        monthlyRatingMap.get(key).push(r.rating);
      });

      const monthlyPerformance = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const ratingsForMonth = monthlyRatingMap.get(key) || [];
          return {
            month: val.month,
            deliverables: val.deliverables,
            rating:
              ratingsForMonth.length > 0
                ? Number(
                    (
                      ratingsForMonth.reduce((a, b) => a + b, 0) /
                      ratingsForMonth.length
                    ).toFixed(1),
                  )
                : null,
          };
        });

      // 5. Project Type Distribution — only from real project categories on awarded bids
      const categoryMap = new Map();
      awardedBids.forEach((b) => {
        const category = b.award?.project?.category;
        if (!category) return;
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });
      const paletteColors = [
        "#0F766E",
        "#D97706",
        "#4F46E5",
        "#059669",
        "#E11D48",
      ];
      const projectTypeDistribution = Array.from(categoryMap.entries()).map(
        ([name, value], i) => ({
          name,
          value,
          color: paletteColors[i % paletteColors.length],
        }),
      );

      // 6. Role-Specific Benchmarks — only include metrics backed by real specialist fields
      const roleSpecificMetricsList = [];
      if (specialist.permitsApprovalRate != null) {
        roleSpecificMetricsList.push({
          label: "Permits & Municipal Approvals",
          value: `${specialist.permitsApprovalRate}%`,
          subtitle: "Regulatory approval rate",
        });
      }
      if (specialist.safetyComplianceRate != null) {
        roleSpecificMetricsList.push({
          label: "Safety & Site Compliance",
          value: `${specialist.safetyComplianceRate}%`,
          subtitle: "Recorded compliance rate",
        });
      }
      if (specialist.milestoneAdherenceRate != null) {
        roleSpecificMetricsList.push({
          label: "Milestone Schedule Adherence",
          value: `${specialist.milestoneAdherenceRate}%`,
          subtitle: "Delivered within target timeline",
        });
      }
      if (specialist.crewSize != null) {
        roleSpecificMetricsList.push({
          label: "Workforce Deployment",
          value: `${specialist.crewSize} Crew`,
          subtitle: "Reported team size",
        });
      }

      const roleSpecificMetrics =
        roleSpecificMetricsList.length > 0
          ? {
              title:
                proRole === "ARCHITECT"
                  ? "Architecture & Structural Integrity"
                  : proRole === "CONTRACTOR"
                    ? "Construction & Civil Execution"
                    : "Interior Design & Fitout Quality",
              metrics: roleSpecificMetricsList,
            }
          : null;

      // 7. Projects Bar Chart Data — only real counts, no fallback constants
      const projectsBarData = [
        { category: "Completed", count: completedProjects, fill: "#059669" },
        { category: "In Progress", count: inProgressProjects, fill: "#0284C7" },
        {
          category: "Quoted / Bidding",
          count: user.bidsSubmitted.length,
          fill: "#D97706",
        },
      ];

      return helper.success(
        res,
        "Professional performance metrics fetched successfully",
        {
          userId: user.id,
          name: user.name,
          role: proRole,
          specialization:
            user.specialization || specialist.specialization || null,
          overview: {
            completedProjects,
            inProgressProjects,
            totalProjects: totalProjectVol,
            successRate,
            onTimeCompletionRate,
            responseRate,
            overallRating: avgRating,
            totalReviews: reviewCount,
          },
          ratings:
            reviewCount > 0 || avgRating != null
              ? {
                  overall: avgRating,
                  quality: qualityScore,
                  communication: communicationScore,
                  timeliness: timelinessScore,
                  budget: budgetScore,
                  distribution: distributionData,
                }
              : null,
          charts: {
            projectsBar: projectsBarData,
            monthlyPerformance,
            projectTypeDistribution,
          },
          roleSpecificMetrics,
          posts: user.posts,
          verifiedReviews: reviews,
        },
      );
    } catch (error) {
      return helper.err(res, error, "/post/performance");
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

      const ALLOWED_ROLES = [2, 3, 4, 5]; // designer, architect, contractor, material supplier

      if (!Number.isInteger(roleNum) || !ALLOWED_ROLES.includes(roleNum)) {
        return helper.failed(
          res,
          "Invalid role. Must be 2 (designer), 3 (architect), 4 (contractor), or 5 (material supplier).",
        );
      }

      const whereCondition = {
        isDeleted: false,
        isBlocked: false,
        role: roleNum,
      };

      const rawUsers = await prisma.user.findMany({
        where: whereCondition,
        select: PORTFOLIO_SELECT_FIELDS,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ posts: { _count: "desc" } }, { createdAt: "desc" }],
      });

      const totalCount = await prisma.user.count({
        where: whereCondition,
      });
      const totalPages = Math.ceil(totalCount / limit) || 1;

      const formattedUsers = rawUsers.map(formatPortfolioUser);

      return helper.success(res, "Portfolios fetched successfully", {
        data: formattedUsers,
        users: formattedUsers,
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
