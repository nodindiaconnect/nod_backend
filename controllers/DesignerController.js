import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

import sanitizeData from "../utils/sanitizeHtml.js";

const MAX_ARRAY_ITEMS = 20;
const MAX_TEXT_LENGTH = 150;
const MAX_URL_LENGTH = 500;

const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "EXPERT"];
const AVAILABILITY_STATUSES = ["AVAILABLE", "BUSY", "UNAVAILABLE"];

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseStringArrayField(
  value,
  {
    fieldName,
    required = false,
    maxItems = MAX_ARRAY_ITEMS,
    maxItemLength = MAX_TEXT_LENGTH,
    mustBeUrl = false,
  },
) {
  if (value === undefined || value === null) {
    if (required) return { ok: false, message: `${fieldName} is required.` };
    return { ok: true, value: [] };
  }
  if (!Array.isArray(value))
    return { ok: false, message: `${fieldName} must be an array.` };
  if (required && value.length === 0)
    return { ok: false, message: `${fieldName} is required.` };
  if (value.length > maxItems)
    return {
      ok: false,
      message: `${fieldName} can have at most ${maxItems} items.`,
    };

  const cleaned = [];
  for (const item of value) {
    if (typeof item !== "string")
      return { ok: false, message: `${fieldName} items must be strings.` };
    const trimmed = mustBeUrl ? item.trim() : sanitizeData(item.trim());
    if (!trimmed) continue;
    if (trimmed.length > (mustBeUrl ? MAX_URL_LENGTH : maxItemLength)) {
      return { ok: false, message: `${fieldName} item too long.` };
    }
    if (mustBeUrl && !isValidUrl(trimmed))
      return { ok: false, message: `${fieldName} must contain valid URLs.` };
    cleaned.push(trimmed);
  }
  return { ok: true, value: cleaned };
}

// --------------------------------------------------
// profile column is stored as a JSON *string* on User.
// These two helpers keep read/write consistent so we
// never again save a plain string into a JSON field.
// --------------------------------------------------
function parseProfileBlob(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw; // already an object (e.g. Prisma Json column)
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // legacy rows where `profile` was a plain bio string
    return { bio: raw };
  }
}

function safeArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

class DesignController {
  // static async getUserDetails(req, res, next) {
  //     try {
  //         const userId = req.user.id;

  //         const user = await prisma.user.findUnique({
  //             where: { id: userId },
  //             select: {
  //                 id: true,
  //                 name: true,
  //                 username: true,
  //                 email: true,
  //                 phone: true,
  //                 countryCode: true,
  //                 role: true,
  //                 country: true,
  //                 state: true,
  //                 city: true,
  //                 address: true,
  //                 activeDate: true,
  //                 isVerified: true,
  //                 isBlocked: true,
  //                 walletBalance: true,
  //             },
  //         });

  //         if (!user) {
  //             return helper.failed(res, "User not found");
  //         }

  //         const designer = await prisma.designer.findUnique({
  //             where: { userId },
  //             select: {
  //                 totalProjectsHandled: true,
  //                 projectsInProgress: true,
  //                 projectsCompleted: true,
  //                 totalQuotationsSent: true,
  //                 quotationsPending: true,
  //                 quotationsAccepted: true,
  //                 quotationsRejected: true,
  //             },
  //         });

  //         return helper.success(res, "User details fetched successfully", {
  //             id: user.id,
  //             name: user.name,
  //             username: user.username,
  //             email: user.email,
  //             phone: user.phone,
  //             role: ACCOUNT_TYPE_NAMES[user.role] ?? "Unknown",
  //             country: user.country,
  //             state: user.state,
  //             city: user.city,
  //             address: user.address,
  //             walletBalance: user.walletBalance,
  //             projectStats: {
  //                 totalProjects: designer?.totalProjectsHandled ?? 0,
  //                 activeProjects: designer?.projectsInProgress ?? 0,
  //                 completedProjects: designer?.projectsCompleted ?? 0,
  //             },
  //             quotationStats: {
  //                 totalQuotationsSent: designer?.totalQuotationsSent ?? 0,
  //                 quotationsPending: designer?.quotationsPending ?? 0,
  //                 quotationsAccepted: designer?.quotationsAccepted ?? 0,
  //                 quotationsRejected: designer?.quotationsRejected ?? 0,
  //             },
  //         });
  //     } catch (error) {
  //         next(error);
  //     }
  // }

  // GET /api/designer/me/quotations?status=PENDING|ACCEPTED|REJECTED

  static async getUserDetails(req, res, next) {
    try {
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

          projects: {
            select: {
              id: true,
              title: true,
              status: true,
              budgetMin: true,
              budgetMax: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const projects = user.projects || [];

      const projectStats = {
        totalProjects: projects.length,

        activeProjects: projects.filter(
          (project) => project.status === "IN_PROGRESS",
        ).length,

        completedProjects: projects.filter(
          (project) => project.status === "COMPLETED",
        ).length,
      };

      return helper.success(res, "User details fetched successfully", {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        role: ACCOUNT_TYPE_NAMES[user.role] ?? "Unknown",
        country: user.country,
        state: user.state,
        city: user.city,
        address: user.address,
        activeDate: user.activeDate,
        isVerified: user.isVerified,
        isBlocked: user.isBlocked,
        walletBalance: user.walletBalance,

        projects,

        projectStats,
      });
    } catch (error) {
      next(error);
    }
  }
  static async getQuotations(req, res) {
    try {
      const userId = req.user.id;

      const bids = await prisma.bid.findMany({
        where: { designerId: userId },
        include: { project: true },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({ success: true, data: bids });
    } catch (err) {
      console.error("designerController.getQuotations error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch quotations" });
    }
  }

  // POST /api/designer/quotations
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

      const designer = await prisma.designer.findUnique({ where: { userId } });
      if (!designer) {
        return res
          .status(404)
          .json({ success: false, message: "Designer profile not found" });
      }

      const bid = await prisma.$transaction(async (tx) => {
        const created = await tx.bid.create({
          data: {
            projectId,
            designerId: designer.id,
            quotedPrice,
            proposedDuration,
            proposal,
            portfolioLink,
            status: "PENDING",
          },
        });

        await tx.designer.update({
          where: { id: designer.id },
          data: {
            totalQuotationsSent: { increment: 1 },
            quotationsPending: { increment: 1 },
          },
        });

        return created;
      });

      return res.status(201).json({ success: true, data: bid });
    } catch (err) {
      console.error("designerController.sendQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send quotation" });
    }
  }

  static async getProjectsToBid(req, res) {
    try {
      const { status } = req.query;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const where = {
        servicesRequired: { has: "INTERIOR_DESIGNER" },
        availabilityStatus: "OPEN",
        ...(status ? { status } : {}),
      };

      const [projects, totalProjects] = await Promise.all([
        prisma.project.findMany({
          where,
          include: { attachments: true },
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
      console.error("designerController.getProjects error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch projects" });
    }
  }

  static async withdrawQuotation(req, res) {
    try {
      const userId = req.user.id;
      const { bidId } = req.params;

      const designer = await prisma.designer.findUnique({ where: { userId } });
      if (!designer) {
        return res
          .status(404)
          .json({ success: false, message: "Designer profile not found" });
      }

      const bid = await prisma.bid.findFirst({
        where: { id: bidId, designerId: designer.id },
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
        await tx.designer.update({
          where: { id: designer.id },
          data: { quotationsPending: { decrement: 1 } },
        });
        return u;
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      console.error("designerController.withdrawQuotation error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to withdraw quotation" });
    }
  }

  // --------------------------------------------------
  // GET /api/designer/me/profile
  // Merges User columns + parsed `profile` JSON blob + Designer table
  // into ONE flat object the frontend can bind straight to form state.
  // --------------------------------------------------
  static async getMyProfile(req, res) {
    try {
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
          country: true,
          state: true,
          city: true,
          address: true,
          profile: true,
          designer: true,
        },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const profileBlob = parseProfileBlob(user.profile);
      const designer = user.designer || {};

      const designerPhotos = safeArray(designer.photos);
      const profileImageUrl =
        (designerPhotos.length > 0 ? designerPhotos[0] : null) ||
        (typeof user.profile === "string" &&
        (user.profile.startsWith("http://") ||
          user.profile.startsWith("https://") ||
          user.profile.startsWith("/uploads") ||
          user.profile.startsWith("data:") ||
          user.profile.startsWith("blob:"))
          ? user.profile.trim()
          : null);

      return helper.success(res, "Profile fetched successfully", {
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
        profileImageUrl: profileImageUrl || null,
        profile: profileImageUrl || null,

        // bio: prefer designer table value, fall back to legacy profile blob
        bio: designer.bio ?? profileBlob.bio ?? "",

        yearsOfExperience:
          designer.yearsOfExperience ?? profileBlob.experience ?? "",
        experienceLevel: designer.experienceLevel ?? "",
        availability: designer.availability ?? "",

        designStyles: safeArray(designer.designStyles).length
          ? safeArray(designer.designStyles)
          : profileBlob.style
            ? [profileBlob.style]
            : [],
        specializations: safeArray(designer.specializations).length
          ? safeArray(designer.specializations)
          : profileBlob.specialization
            ? [profileBlob.specialization]
            : [],
        certifications: safeArray(designer.certifications),
        serviceCities: safeArray(designer.serviceCities),
        portfolioLinks: safeArray(designer.portfolioLinks),
        photos: designerPhotos.length > 0 ? designerPhotos : (profileImageUrl ? [profileImageUrl] : []),

        minBudgetHandled: designer.minBudgetHandled ?? "",
        maxBudgetHandled: designer.maxBudgetHandled ?? "",

        verificationStatus: designer.verificationStatus ?? "PENDING",
        rating: designer.rating ?? 0,
        totalReviews: designer.totalReviews ?? 0,
      });
    } catch (error) {
      console.error("DesignerController.getMyProfile error:", error);
      return helper.failed(res, "Failed to fetch profile");
    }
  }

  // --------------------------------------------------
  // PATCH /api/designer/me/profile
  // --------------------------------------------------
  static async editMyProfile(req, res) {
    try {
      const userId = req.user.id;

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
        availability,
        certifications,
        designStyles,
        maxBudgetHandled,
        minBudgetHandled,
        photos,
        portfolioLinks,
        serviceCities,
        specializations,
        profileImageUrl,
        profile,
        image,
      } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { designer: true },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      if (user.role !== 2) {
        return helper.failed(res, "Only designers can update designer profile");
      }

      // --------------------------------------------------
      // Validate array fields (sanitize + cap length/size)
      // --------------------------------------------------
      const arrayValidators = {
        certifications: { value: certifications, fieldName: "certifications" },
        designStyles: {
          value: designStyles,
          fieldName: "designStyles",
          required: true,
        },
        specializations: {
          value: specializations,
          fieldName: "specializations",
          required: true,
        },
        serviceCities: {
          value: serviceCities,
          fieldName: "serviceCities",
          required: true,
        },
        photos: {
          value: photos,
          fieldName: "photos",
          mustBeUrl: true,
          maxItems: 30,
        },
        portfolioLinks: {
          value: portfolioLinks,
          fieldName: "portfolioLinks",
          mustBeUrl: true,
        },
      };

      const cleanedArrays = {};
      for (const [key, opts] of Object.entries(arrayValidators)) {
        if (opts.value === undefined) continue; // not being updated
        const result = parseStringArrayField(opts.value, opts);
        if (!result.ok) {
          return helper.failed(res, result.message);
        }
        cleanedArrays[key] = result.value;
      }

      // --------------------------------------------------
      // Validate numeric fields
      // --------------------------------------------------
      if (
        yearsOfExperience !== undefined &&
        (typeof yearsOfExperience !== "number" ||
          isNaN(yearsOfExperience) ||
          yearsOfExperience < 0)
      ) {
        return helper.failed(
          res,
          "yearsOfExperience must be a valid positive number",
        );
      }
      if (
        minBudgetHandled !== undefined &&
        (typeof minBudgetHandled !== "number" ||
          isNaN(minBudgetHandled) ||
          minBudgetHandled < 0)
      ) {
        return helper.failed(
          res,
          "minBudgetHandled must be a valid positive number",
        );
      }
      if (
        maxBudgetHandled !== undefined &&
        (typeof maxBudgetHandled !== "number" ||
          isNaN(maxBudgetHandled) ||
          maxBudgetHandled < 0)
      ) {
        return helper.failed(
          res,
          "maxBudgetHandled must be a valid positive number",
        );
      }
      if (
        minBudgetHandled !== undefined &&
        maxBudgetHandled !== undefined &&
        minBudgetHandled > maxBudgetHandled
      ) {
        return helper.failed(
          res,
          "Minimum budget cannot be greater than maximum budget",
        );
      }

      // --------------------------------------------------
      // Validate enums
      // --------------------------------------------------
      const normalizedExperienceLevel =
        experienceLevel !== undefined
          ? String(experienceLevel).trim().toUpperCase()
          : undefined;
      const normalizedAvailability =
        availability !== undefined
          ? String(availability).trim().toUpperCase()
          : undefined;

      if (
        normalizedExperienceLevel !== undefined &&
        !EXPERIENCE_LEVELS.includes(normalizedExperienceLevel)
      ) {
        return helper.failed(
          res,
          `experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(", ")}`,
        );
      }
      if (
        normalizedAvailability !== undefined &&
        !AVAILABILITY_STATUSES.includes(normalizedAvailability)
      ) {
        return helper.failed(
          res,
          `availability must be one of: ${AVAILABILITY_STATUSES.join(", ")}`,
        );
      }

      const sanitizedBio =
        bio !== undefined
          ? sanitizeData(String(bio).trim()).slice(0, 1000)
          : undefined;

      const photoUrl =
        (Array.isArray(cleanedArrays.photos) && cleanedArrays.photos.length > 0
          ? cleanedArrays.photos[0]
          : null) ||
        (Array.isArray(photos) && photos.length > 0 ? photos[0] : null) ||
        profileImageUrl ||
        (typeof profile === "string" && (profile.startsWith("http") || profile.startsWith("/uploads")) ? profile : null) ||
        image ||
        undefined;

      // --------------------------------------------------
      // Update User + Designer together
      // --------------------------------------------------
      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(countryCode !== undefined && { countryCode }),
            ...(country !== undefined && { country }),
            ...(state !== undefined && { state }),
            ...(city !== undefined && { city }),
            ...(address !== undefined && { address }),
            ...(photoUrl !== undefined && { profile: photoUrl ? String(photoUrl).trim() : null }),
          },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            countryCode: true,
            country: true,
            state: true,
            city: true,
            address: true,
            profile: true,
          },
        });

        const designerPhotosToSave =
          cleanedArrays.photos !== undefined
            ? cleanedArrays.photos
            : photoUrl
            ? [photoUrl]
            : undefined;

        const designerData = {
          ...(sanitizedBio !== undefined && { bio: sanitizedBio }),
          ...(yearsOfExperience !== undefined && { yearsOfExperience }),
          ...(normalizedExperienceLevel !== undefined && {
            experienceLevel: normalizedExperienceLevel,
          }),
          ...(normalizedAvailability !== undefined && {
            availability: normalizedAvailability,
          }),
          ...(cleanedArrays.certifications !== undefined && {
            certifications: cleanedArrays.certifications,
          }),
          ...(cleanedArrays.designStyles !== undefined && {
            designStyles: cleanedArrays.designStyles,
          }),
          ...(maxBudgetHandled !== undefined && { maxBudgetHandled }),
          ...(minBudgetHandled !== undefined && { minBudgetHandled }),
          ...(designerPhotosToSave !== undefined && {
            photos: designerPhotosToSave,
          }),
          ...(cleanedArrays.portfolioLinks !== undefined && {
            portfolioLinks: cleanedArrays.portfolioLinks,
          }),
          ...(cleanedArrays.serviceCities !== undefined && {
            serviceCities: cleanedArrays.serviceCities,
          }),
          ...(cleanedArrays.specializations !== undefined && {
            specializations: cleanedArrays.specializations,
          }),
        };

        let updatedDesigner;
        if (user.designer) {
          updatedDesigner = await tx.designer.update({
            where: { userId },
            data: designerData,
          });
        } else {
          updatedDesigner = await tx.designer.create({
            data: {
              userId,
              bio: sanitizedBio ?? null,
              yearsOfExperience: yearsOfExperience ?? null,
              experienceLevel: normalizedExperienceLevel ?? null,
              availability: normalizedAvailability ?? null,
              certifications: cleanedArrays.certifications ?? [],
              designStyles: cleanedArrays.designStyles ?? [],
              maxBudgetHandled: maxBudgetHandled ?? null,
              minBudgetHandled: minBudgetHandled ?? null,
              photos: designerPhotosToSave ?? [],
              portfolioLinks: cleanedArrays.portfolioLinks ?? [],
              serviceCities: cleanedArrays.serviceCities ?? [],
              specializations: cleanedArrays.specializations ?? [],
            },
          });
        }

        return { updatedUser, updatedDesigner };
      });

      const finalImageUrl =
        (Array.isArray(result.updatedDesigner.photos) && result.updatedDesigner.photos.length > 0
          ? result.updatedDesigner.photos[0]
          : null) ||
        result.updatedUser.profile ||
        null;

      return helper.success(res, "Profile updated successfully", {
        id: result.updatedUser.id,
        name: result.updatedUser.name,
        username: result.updatedUser.username,
        email: result.updatedUser.email,
        phone: result.updatedUser.phone,
        countryCode: result.updatedUser.countryCode,
        country: result.updatedUser.country,
        state: result.updatedUser.state,
        city: result.updatedUser.city,
        address: result.updatedUser.address,
        profileImageUrl: finalImageUrl,
        profile: finalImageUrl,

        bio: result.updatedDesigner.bio,
        yearsOfExperience: result.updatedDesigner.yearsOfExperience,
        experienceLevel: result.updatedDesigner.experienceLevel,
        availability: result.updatedDesigner.availability,
        certifications: result.updatedDesigner.certifications,
        designStyles: result.updatedDesigner.designStyles,
        maxBudgetHandled: result.updatedDesigner.maxBudgetHandled,
        minBudgetHandled: result.updatedDesigner.minBudgetHandled,
        photos: result.updatedDesigner.photos,
        portfolioLinks: result.updatedDesigner.portfolioLinks,
        serviceCities: result.updatedDesigner.serviceCities,
        specializations: result.updatedDesigner.specializations,
      });
    } catch (error) {
      console.error("DesignerController.editMyProfile error:", error);

      if (error.code === "P2002") {
        return helper.failed(res, "This value is already in use.");
      }
      if (error.code === "P2025") {
        return helper.failed(res, "Profile record not found.");
      }

      return helper.failed(res, "Failed to update profile");
    }
  }
}

export default DesignController;
