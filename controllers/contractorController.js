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

class ContractorController {
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

  // GET /api/contractor/me/overview
  // Returns profile + quotation/project stats for the logged-in contractor's dashboard
  static async getOverview(req, res) {
    try {
      const userId = req.user.id; // set by auth middleware

      const contractor = await prisma.contractor.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!contractor) {
        return res
          .status(404)
          .json({ success: false, message: "Contractor profile not found" });
      }

      const projectStats = {
        totalProjects: contractor.totalProjectsHandled,
        activeProjects: contractor.projectsInProgress,
        completedProjects: contractor.projectsCompleted,
        pendingProjects: contractor.quotationsPending,
        cancelledProjects: contractor.quotationsRejected,
      };

      const quotationStats = {
        totalQuotationsSent: contractor.totalQuotationsSent,
        quotationsPending: contractor.quotationsPending,
        quotationsAccepted: contractor.quotationsAccepted,
        quotationsRejected: contractor.quotationsRejected,
      };

      return res.status(200).json({
        success: true,
        data: {
          name: contractor.user.name,
          username: contractor.user.username,
          email: contractor.user.email,
          phone: contractor.user.phone,
          countryCode: contractor.user.countryCode,
          city: contractor.user.city,
          country: contractor.user.country,
          isVerified: contractor.verificationStatus === "VERIFIED",
          role: 4,
          walletBalance: contractor.user.walletBalance ?? 0,
          projectStats,
          quotationStats,
        },
      });
    } catch (err) {
      console.error("contractorController.getOverview error:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch contractor overview",
        });
    }
  }

  // GET /api/contractor/me/quotations?status=PENDING|ACCEPTED|REJECTED
  static async getQuotations(req, res) {
    try {
      const userId = req.user.id;

      const bids = await prisma.bid.findMany({
        where: {
          contractorId: userId,
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
      console.error("contractorController.getQuotations error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch quotations",
      });
    }
  }
  // POST /api/contractor/quotations
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

      const contractor = await prisma.contractor.findUnique({
        where: { userId },
      });
      if (!contractor) {
        return res
          .status(404)
          .json({ success: false, message: "Contractor profile not found" });
      }

      const bid = await prisma.$transaction(async (tx) => {
        const created = await tx.bid.create({
          data: {
            projectId,
            contractorId: contractor.id,
            quotedPrice,
            proposedDuration,
            proposal,
            portfolioLink,
            status: "PENDING",
          },
        });

        await tx.contractor.update({
          where: { id: contractor.id },
          data: {
            totalQuotationsSent: { increment: 1 },
            quotationsPending: { increment: 1 },
          },
        });

        return created;
      });

      return res.status(201).json({ success: true, data: bid });
    } catch (err) {
      console.error("contractorController.sendQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send quotation" });
    }
  }

  // GET /api/contractor/me/projects?status=IN_PROGRESS|COMPLETED

  // GET /api/contractor/me/projects?status=IN_PROGRESS|COMPLETED&page=1&limit=10
  // static async getProjectsToBid(req, res) {
  //   try {
  //     const { status } = req.query
  //     const page = parseInt(req.query.page, 10) || 1
  //     const limit = parseInt(req.query.limit, 10) || 10
  //     const skip = (page - 1) * limit

  //     const where = {
  //       servicesRequired: { has: "CONTRACTOR" },
  //       ...(status ? { status } : {}),
  //     }

  //     const [projects, totalProjects] = await Promise.all([
  //       prisma.project.findMany({
  //         where,
  //         include: {
  //           attachments: true,
  //         },
  //         orderBy: { createdAt: "desc" },
  //         skip,
  //         take: limit,
  //       }),
  //       prisma.project.count({ where }),
  //     ])

  //     return res.status(200).json({
  //       success: true,
  //       data: projects,
  //       pagination: {
  //         total: totalProjects,
  //         page,
  //         limit,
  //         totalPages: Math.ceil(totalProjects / limit),
  //       },
  //     })
  //   } catch (err) {
  //     console.error("contractorController.getProjects error:", err)
  //     return res.status(500).json({ success: false, message: "Failed to fetch projects" })
  //   }
  // }

  static async getProjectsToBid(req, res) {
    try {
      const { status } = req.query;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const where = {
        servicesRequired: { has: "CONTRACTOR" },
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
      console.error("contractorController.getProjects error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch projects" });
    }
  }

  // PATCH /api/contractor/quotations/:bidId/withdraw
  static async withdrawQuotation(req, res) {
    try {
      const userId = req.user.id;
      const { bidId } = req.params;

      const contractor = await prisma.contractor.findUnique({
        where: { userId },
      });
      if (!contractor) {
        return res
          .status(404)
          .json({ success: false, message: "Contractor profile not found" });
      }

      const bid = await prisma.bid.findFirst({
        where: { id: bidId, contractorId: contractor.id },
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
        await tx.contractor.update({
          where: { id: contractor.id },
          data: { quotationsPending: { decrement: 1 } },
        });
        return u;
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      console.error("contractorController.withdrawQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to withdraw quotation" });
    }
  }

  // GET /api/Contractor/me/profile
  static async getMyProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { contractor: true },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const contractor = user.contractor || {};
      const profileImageUrl =
        typeof user.profile === "string" &&
        (user.profile.startsWith("http://") ||
          user.profile.startsWith("https://") ||
          user.profile.startsWith("/uploads") ||
          user.profile.startsWith("data:") ||
          user.profile.startsWith("blob:"))
          ? user.profile.trim()
          : null;

      return helper.success(res, "Contractor profile fetched successfully", {
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
        bio: contractor.bio || "",
        yearsOfExperience: contractor.yearsOfExperience ?? "",
        experienceLevel: contractor.experienceLevel || "",
        workTypes: safeJsonArray(contractor.workTypes),
        specializations: safeJsonArray(contractor.workTypes),
        teamSize: contractor.teamSize ?? "",
        licenseNumber: contractor.licenseNumber || "",
        gstNumber: contractor.gstNumber || "",
        certifications: safeJsonArray(contractor.certifications),
        portfolioLinks: safeJsonArray(contractor.portfolioLinks),
        serviceCities: safeJsonArray(contractor.serviceCities),
        minBudgetHandled: contractor.minBudgetHandled ?? "",
        maxBudgetHandled: contractor.maxBudgetHandled ?? "",
        availability: contractor.availability || "AVAILABLE",
        verificationStatus: contractor.verificationStatus || "PENDING",
        rating: contractor.rating ?? 0,
        totalReviews: contractor.totalReviews ?? 0,
      });
    } catch (err) {
      console.error("ContractorController.getMyProfile error:", err);
      return helper.failed(res, "Failed to fetch contractor profile");
    }
  }

  // PATCH /api/Contractor/me/profile
  static async editMyProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { contractor: true },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      if (user.role !== 4) {
        return helper.failed(res, "Only contractors can update contractor profile");
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
        workTypes,
        specializations,
        teamSize,
        licenseNumber,
        gstNumber,
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

      const rawWorkTypes = workTypes !== undefined ? workTypes : specializations;

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

        const contractorPayload = {
          ...(bio !== undefined && { bio: sanitizeData(String(bio).trim()) }),
          ...(yearsOfExperience !== undefined && { yearsOfExperience: Number(yearsOfExperience) || 0 }),
          ...(experienceLevel !== undefined && { experienceLevel }),
          ...(rawWorkTypes !== undefined && {
            workTypes: JSON.stringify(Array.isArray(rawWorkTypes) ? rawWorkTypes : [rawWorkTypes]),
          }),
          ...(teamSize !== undefined && { teamSize: Number(teamSize) || null }),
          ...(licenseNumber !== undefined && { licenseNumber: sanitizeData(String(licenseNumber).trim()) }),
          ...(gstNumber !== undefined && { gstNumber: sanitizeData(String(gstNumber).trim()) }),
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

        const updatedContractor = await tx.contractor.upsert({
          where: { userId },
          update: contractorPayload,
          create: {
            userId,
            yearsOfExperience: Number(yearsOfExperience) || 0,
            experienceLevel: experienceLevel || "INTERMEDIATE",
            workTypes: JSON.stringify(Array.isArray(rawWorkTypes) ? rawWorkTypes : []),
            certifications: JSON.stringify(Array.isArray(certifications) ? certifications : []),
            portfolioLinks: JSON.stringify(Array.isArray(portfolioLinks) ? portfolioLinks : []),
            serviceCities: JSON.stringify(Array.isArray(serviceCities) ? serviceCities : []),
            minBudgetHandled: Number(minBudgetHandled) || 0,
            maxBudgetHandled: Number(maxBudgetHandled) || 0,
            ...contractorPayload,
          },
        });

        return { user: updatedUser, contractor: updatedContractor };
      });

      const finalImageUrl = updated.user.profile || null;

      return helper.success(res, "Contractor profile updated successfully", {
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
        bio: updated.contractor.bio || "",
        yearsOfExperience: updated.contractor.yearsOfExperience ?? 0,
        experienceLevel: updated.contractor.experienceLevel || "",
        workTypes: safeJsonArray(updated.contractor.workTypes),
        specializations: safeJsonArray(updated.contractor.workTypes),
        teamSize: updated.contractor.teamSize ?? null,
        licenseNumber: updated.contractor.licenseNumber || "",
        gstNumber: updated.contractor.gstNumber || "",
        certifications: safeJsonArray(updated.contractor.certifications),
        portfolioLinks: safeJsonArray(updated.contractor.portfolioLinks),
        serviceCities: safeJsonArray(updated.contractor.serviceCities),
        minBudgetHandled: updated.contractor.minBudgetHandled ?? 0,
        maxBudgetHandled: updated.contractor.maxBudgetHandled ?? 0,
        availability: updated.contractor.availability || "AVAILABLE",
        verificationStatus: updated.contractor.verificationStatus || "PENDING",
        rating: updated.contractor.rating ?? 0,
        totalReviews: updated.contractor.totalReviews ?? 0,
      });
    } catch (err) {
      console.error("ContractorController.editMyProfile error:", err);
      return helper.failed(res, err?.message || "Failed to update contractor profile");
    }
  }
}

export default ContractorController;
