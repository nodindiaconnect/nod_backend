import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";
import sanitizeData from "../utils/sanitizeHtml.js";

function safeJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) ? p : [];
  } catch {
    return typeof val === "string" ? [val] : [];
  }
}

const ACCOUNT_TYPES = {
  Client: 1,
  Designer: 2,
  Architect: 3,
  Contractor: 4,
  MaterialSupplier: 5,
};

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
  Object.entries(ACCOUNT_TYPES).map(([name, code]) => [code, name]),
);

class ArchitechController {
  static async getUserDetails(req, res, next) {
    try {
      // console.log(req.user, "userId123")

      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          countryCode: true,
          role: true,
          country: true,
          state: true,
          city: true,
          address: true,
          activeDate: true,
          isVerified: true,
          isBlocked: true,
          wallets: {
            select: {
              totalAvailableBalance: true,
            },
          },
        },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      return helper.success(res, "User details fetched successfully", {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: ACCOUNT_TYPE_NAMES[user.role] ?? "Unknown",
        country: user.country,
        state: user.state,
        city: user.city,
        address: user.address,
        walletBalance: user.walletBalance,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/architect/me/overview
  // Returns profile + quotation/project stats for the logged-in architect's dashboard
  static async getOverview(req, res) {
    try {
      const userId = req.user.id; // set by auth middleware

      const architect = await prisma.architect.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!architect) {
        return res
          .status(404)
          .json({ success: false, message: "Architect profile not found" });
      }

      const projectStats = {
        totalProjects: architect.totalProjectsHandled,
        activeProjects: architect.projectsInProgress,
        completedProjects: architect.projectsCompleted,
        pendingProjects: architect.quotationsPending,
        cancelledProjects: architect.quotationsRejected,
      };

      const quotationStats = {
        totalQuotationsSent: architect.totalQuotationsSent,
        quotationsPending: architect.quotationsPending,
        quotationsAccepted: architect.quotationsAccepted,
        quotationsRejected: architect.quotationsRejected,
      };

      return res.status(200).json({
        success: true,
        data: {
          name: architect.user.name,
          username: architect.user.username,
          email: architect.user.email,
          phone: architect.user.phone,
          countryCode: architect.user.countryCode,
          city: architect.user.city,
          country: architect.user.country,
          isVerified: architect.verificationStatus === "VERIFIED",
          role: 3,
          walletBalance: architect.user.walletBalance ?? 0,
          projectStats,
          quotationStats,
        },
      });
    } catch (err) {
      console.error("architectController.getOverview error:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch architect overview",
        });
    }
  }

  // GET /api/architect/me/quotations?status=PENDING|ACCEPTED|REJECTED
  static async getQuotations(req, res) {
    try {
      const userId = req.user.id;

      const bids = await prisma.bid.findMany({
        where: {
          architectId: userId,
        },
        include: {
          project: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.status(200).json({
        success: true,
        data: bids,
      });
    } catch (err) {
      console.error("architectController.getQuotations error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch quotations",
      });
    }
  }
  // POST /api/architect/quotations
  // Send a new quotation/bid on a project
  static async sendQuotation(req, res) {
    try {
      const userId = req.user.id;
      const {
        projectId,
        quotedPrice,
        proposedDuration,
        proposal,
        portfolioLink,
      } = req.body;

      if (!projectId || !quotedPrice || !proposedDuration || !proposal) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Missing required quotation fields",
          });
      }

      const architect = await prisma.architect.findUnique({
        where: { userId },
      });
      if (!architect) {
        return res
          .status(404)
          .json({ success: false, message: "Architect profile not found" });
      }

      const bid = await prisma.$transaction(async (tx) => {
        const created = await tx.bid.create({
          data: {
            projectId,
            architectId: architect.id,
            quotedPrice,
            proposedDuration,
            proposal,
            portfolioLink,
            status: "PENDING",
          },
        });

        await tx.architect.update({
          where: { id: architect.id },
          data: {
            totalQuotationsSent: { increment: 1 },
            quotationsPending: { increment: 1 },
          },
        });

        return created;
      });

      return res.status(201).json({ success: true, data: bid });
    } catch (err) {
      console.error("architectController.sendQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send quotation" });
    }
  }

  // GET /api/architect/me/projects?status=IN_PROGRESS|COMPLETED

  // GET /api/architect/me/projects?status=IN_PROGRESS|COMPLETED&page=1&limit=10
  // static async getProjectsToBid(req, res) {
  //     try {
  //         const { status } = req.query
  //         const page = parseInt(req.query.page, 10) || 1
  //         const limit = parseInt(req.query.limit, 10) || 10
  //         const skip = (page - 1) * limit

  //         const where = {
  //             servicesRequired: { has: "ARCHITECT" },
  //             ...(status ? { status } : {}),
  //         }

  //         const [projects, totalProjects] = await Promise.all([
  //             prisma.project.findMany({
  //                 where,
  //                 include: {
  //                     attachments: true,
  //                 },
  //                 orderBy: { createdAt: "desc" },
  //                 skip,
  //                 take: limit,
  //             }),
  //             prisma.project.count({ where }),
  //         ])

  //         return res.status(200).json({
  //             success: true,
  //             data: projects,
  //             pagination: {
  //                 total: totalProjects,
  //                 page,
  //                 limit,
  //                 totalPages: Math.ceil(totalProjects / limit),
  //             },
  //         })
  //     } catch (err) {
  //         console.error("architectController.getProjects error:", err)
  //         return res.status(500).json({ success: false, message: "Failed to fetch projects" })
  //     }
  // }

  static async getProjectsToBid(req, res) {
    try {
      const { status } = req.query;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const where = {
        servicesRequired: { has: "ARCHITECT" },
        availabilityStatus: "OPEN", // ✅ only fetch projects open for bidding
        ...(status ? { status } : {}),
      };

      const [projects, totalProjects] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            attachments: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: projects,
        pagination: {
          total: totalProjects,
          page,
          limit,
          totalPages: Math.ceil(totalProjects / limit),
        },
      });
    } catch (err) {
      console.error("architectController.getProjects error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch projects" });
    }
  }

  // PATCH /api/architect/quotations/:bidId/withdraw
  static async withdrawQuotation(req, res) {
    try {
      const userId = req.user.id;
      const { bidId } = req.params;

      const architect = await prisma.architect.findUnique({
        where: { userId },
      });
      if (!architect) {
        return res
          .status(404)
          .json({ success: false, message: "Architect profile not found" });
      }

      const bid = await prisma.bid.findFirst({
        where: { id: bidId, architectId: architect.id },
      });
      if (!bid) {
        return res
          .status(404)
          .json({ success: false, message: "Quotation not found" });
      }
      if (bid.status !== "PENDING") {
        return res
          .status(400)
          .json({
            success: false,
            message: "Only pending quotations can be withdrawn",
          });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.bid.update({
          where: { id: bidId },
          data: { status: "WITHDRAWN" },
        });
        await tx.architect.update({
          where: { id: architect.id },
          data: { quotationsPending: { decrement: 1 } },
        });
        return u;
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      console.error("architectController.withdrawQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to withdraw quotation" });
    }
  }

  // GET /api/Architech/me/profile
  static async getMyProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { architect: true },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const architect = user.architect || {};
      const profileImageUrl =
        typeof user.profile === "string" &&
        (user.profile.startsWith("http://") ||
          user.profile.startsWith("https://") ||
          user.profile.startsWith("/uploads") ||
          user.profile.startsWith("data:") ||
          user.profile.startsWith("blob:"))
          ? user.profile.trim()
          : null;

      return helper.success(res, "Architect profile fetched successfully", {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        country: user.country,
        state: user.state,
        city: user.city,
        address: user.address,
        profileImageUrl,
        profile: profileImageUrl,
        photos: profileImageUrl ? [profileImageUrl] : [],
        bio: architect.bio || "",
        yearsOfExperience: architect.yearsOfExperience ?? "",
        experienceLevel: architect.experienceLevel || "",
        specializations: safeJsonArray(architect.specializations),
        licenseNumber: architect.licenseNumber || "",
        licenseIssuingBody: architect.licenseIssuingBody || "",
        certifications: safeJsonArray(architect.certifications),
        portfolioLinks: safeJsonArray(architect.portfolioLinks),
        serviceCities: safeJsonArray(architect.serviceCities),
        minBudgetHandled: architect.minBudgetHandled ?? "",
        maxBudgetHandled: architect.maxBudgetHandled ?? "",
        availability: architect.availability || "AVAILABLE",
        verificationStatus: architect.verificationStatus || "PENDING",
        rating: architect.rating ?? 0,
        totalReviews: architect.totalReviews ?? 0,
      });
    } catch (err) {
      console.error("ArchitechController.getMyProfile error:", err);
      return helper.failed(res, "Failed to fetch architect profile");
    }
  }

  // PATCH /api/Architech/me/profile
  static async editMyProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { architect: true },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      if (user.role !== 3) {
        return helper.failed(res, "Only architects can update architect profile");
      }

      const {
        name,
        phone,
        countryCode,
        country,
        state,
        city,
        address,
        bio,
        yearsOfExperience,
        experienceLevel,
        specializations,
        licenseNumber,
        licenseIssuingBody,
        certifications,
        portfolioLinks,
        serviceCities,
        minBudgetHandled,
        maxBudgetHandled,
        availability,
        photos,
        profileImageUrl,
        profile,
        image,
      } = req.body;

      const photoUrl =
        (Array.isArray(photos) && photos.length > 0 ? photos[0] : null) ||
        profileImageUrl ||
        profile ||
        image ||
        undefined;

      if (bio !== undefined && bio !== null && /\d/.test(String(bio))) {
        return helper.failed(res, "Bio cannot contain numbers");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name: sanitizeData(String(name).trim()) }),
            ...(phone !== undefined && { phone: sanitizeData(String(phone).trim()) }),
            ...(countryCode !== undefined && { countryCode: sanitizeData(String(countryCode).trim()) }),
            ...(country !== undefined && { country: sanitizeData(String(country).trim()) }),
            ...(state !== undefined && { state: sanitizeData(String(state).trim()) }),
            ...(city !== undefined && { city: sanitizeData(String(city).trim()) }),
            ...(address !== undefined && { address: sanitizeData(String(address).trim()) }),
            ...(photoUrl !== undefined && { profile: photoUrl ? String(photoUrl).trim() : null }),
          },
        });

        const architectPayload = {
          ...(bio !== undefined && { bio: sanitizeData(String(bio).trim()) }),
          ...(yearsOfExperience !== undefined && { yearsOfExperience: Number(yearsOfExperience) || 0 }),
          ...(experienceLevel !== undefined && { experienceLevel }),
          ...(specializations !== undefined && {
            specializations: JSON.stringify(Array.isArray(specializations) ? specializations : [specializations]),
          }),
          ...(licenseNumber !== undefined && { licenseNumber: sanitizeData(String(licenseNumber).trim()) }),
          ...(licenseIssuingBody !== undefined && { licenseIssuingBody: sanitizeData(String(licenseIssuingBody).trim()) }),
          ...(certifications !== undefined && {
            certifications: JSON.stringify(Array.isArray(certifications) ? certifications : []),
          }),
          ...(portfolioLinks !== undefined && {
            portfolioLinks: JSON.stringify(Array.isArray(portfolioLinks) ? portfolioLinks : []),
          }),
          ...(serviceCities !== undefined && {
            serviceCities: JSON.stringify(Array.isArray(serviceCities) ? serviceCities : []),
          }),
          ...(minBudgetHandled !== undefined && { minBudgetHandled: Number(minBudgetHandled) || 0 }),
          ...(maxBudgetHandled !== undefined && { maxBudgetHandled: Number(maxBudgetHandled) || 0 }),
          ...(availability !== undefined && { availability }),
        };

        const updatedArchitect = await tx.architect.upsert({
          where: { userId },
          update: architectPayload,
          create: {
            userId,
            yearsOfExperience: Number(yearsOfExperience) || 0,
            experienceLevel: experienceLevel || "INTERMEDIATE",
            specializations: JSON.stringify(Array.isArray(specializations) ? specializations : []),
            licenseNumber: licenseNumber ? sanitizeData(String(licenseNumber).trim()) : `ARCH-${Date.now()}`,
            certifications: JSON.stringify(Array.isArray(certifications) ? certifications : []),
            portfolioLinks: JSON.stringify(Array.isArray(portfolioLinks) ? portfolioLinks : []),
            serviceCities: JSON.stringify(Array.isArray(serviceCities) ? serviceCities : []),
            minBudgetHandled: Number(minBudgetHandled) || 0,
            maxBudgetHandled: Number(maxBudgetHandled) || 0,
            ...architectPayload,
          },
        });

        return { user: updatedUser, architect: updatedArchitect };
      });

      const finalImageUrl = updated.user.profile || null;

      return helper.success(res, "Architect profile updated successfully", {
        id: updated.user.id,
        name: updated.user.name,
        username: updated.user.username,
        email: updated.user.email,
        phone: updated.user.phone,
        countryCode: updated.user.countryCode,
        country: updated.user.country,
        state: updated.user.state,
        city: updated.user.city,
        address: updated.user.address,
        profileImageUrl: finalImageUrl,
        profile: finalImageUrl,
        photos: finalImageUrl ? [finalImageUrl] : [],
        bio: updated.architect.bio || "",
        yearsOfExperience: updated.architect.yearsOfExperience ?? 0,
        experienceLevel: updated.architect.experienceLevel || "",
        specializations: safeJsonArray(updated.architect.specializations),
        licenseNumber: updated.architect.licenseNumber || "",
        licenseIssuingBody: updated.architect.licenseIssuingBody || "",
        certifications: safeJsonArray(updated.architect.certifications),
        portfolioLinks: safeJsonArray(updated.architect.portfolioLinks),
        serviceCities: safeJsonArray(updated.architect.serviceCities),
        minBudgetHandled: updated.architect.minBudgetHandled ?? 0,
        maxBudgetHandled: updated.architect.maxBudgetHandled ?? 0,
        availability: updated.architect.availability || "AVAILABLE",
        verificationStatus: updated.architect.verificationStatus || "PENDING",
        rating: updated.architect.rating ?? 0,
        totalReviews: updated.architect.totalReviews ?? 0,
      });
    } catch (err) {
      console.error("ArchitechController.editMyProfile error:", err);
      return helper.failed(res, err?.message || "Failed to update architect profile");
    }
  }
}

export default ArchitechController;
