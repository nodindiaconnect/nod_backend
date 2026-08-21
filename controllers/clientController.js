import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";
import sanitizeData from "../utils/sanitizeHtml.js";
import ProjectService from "../services/projectService.js";

import pkg from "@prisma/client";
const { Prisma } = pkg;

const ACCOUNT_TYPES = {
    Client: 1,
    Designer: 2,
    Architect: 3,
    Contractor: 4,
    MaterialSupplier: 5,
};

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
    Object.entries(ACCOUNT_TYPES).map(([name, code]) => [code, name])
);

const ENUMS = {
    category: ["RESIDENTIAL", "COMMERCIAL", "OFFICE", "VILLA", "APARTMENT"],
    servicesRequired: ["ARCHITECT", "INTERIOR_DESIGNER", "CONTRACTOR"],
    propertyStatus: ["NEW_CONSTRUCTION", "RENOVATION", "REMODELING"],
    designStyle: [
        "MODERN",
        "MINIMALIST",
        "LUXURY",
        "CONTEMPORARY",
        "TRADITIONAL",
        "SCANDINAVIAN",
    ],
    spaceRequirements: [
        "MODULAR_KITCHEN",
        "WARDROBES",
        "FALSE_CEILING",
        "TV_UNIT",
        "LIGHTING",
        "FURNITURE",
    ],
    clientInvolvement: [
        "HANDS_OFF",
        "OCCASIONAL_CHECK_INS",
        "ACTIVELY_INVOLVED",
    ],
    priority: ["URGENT", "NORMAL", "FLEXIBLE"],
    preferredCommunication: ["CHAT"],
    attachmentType: ["FLOOR_PLAN", "PROPERTY_PHOTO", "REFERENCE_IMAGE", "VIDEO"],
};

// Free-text fields on the project body that need HTML stripped before
// validation/storage. Enums (category, servicesRequired, propertyStatus,
// designStyle, spaceRequirements, clientInvolvement, priority,
// preferredCommunication) are checked against a fixed whitelist in
// validateEnum() below, so sanitizing them is unnecessary. Numbers,
// booleans and dates are coerced/typed separately, and the *Urls
// arrays are filtered to strings before being turned into attachment
// records, so none of those need sanitizing here either.
const FREE_TEXT_FIELDS = [
    "title",
    "description",
    "address",
    "city",
    "state",
    "pincode",
    "accessibilityNeeds",
    "spaceUsers",
    "currentSpaceLikes",
    "currentSpaceProblems",
    "preferredWorkingHours",
    "additionalNotes",
    "colorPreferences",
];

function sanitizeProjectBody(body) {
    FREE_TEXT_FIELDS.forEach((field) => {
        if (typeof body[field] === "string") {
            body[field] = sanitizeData(body[field]);
        }
    });
    return body;
}

function validateEnum(value, allowed, fieldName, errors) {
    if (value === undefined || value === null) return;
    const values = Array.isArray(value) ? value : [value];
    const invalid = values.filter((v) => !allowed.includes(v));
    if (invalid.length) {
        errors.push({ field: fieldName, message: `Invalid value(s): ${invalid.join(", ")}` });
    }
}

const LENGTH_LIMITS = {
    title: { min: 3, max: 150 },
    description: { min: 30, max: 2000 },
    address: { min: 5, max: 300 },
    city: { min: 2, max: 100 },
    state: { min: 2, max: 100 },
    pincode: { min: 3, max: 12 },
    accessibilityNeeds: { min: 0, max: 500 },
    spaceUsers: { min: 0, max: 300 },
    currentSpaceLikes: { min: 0, max: 1000 },
    currentSpaceProblems: { min: 0, max: 1000 },
    preferredWorkingHours: { min: 0, max: 100 },
    additionalNotes: { min: 0, max: 2000 },
    colorPreferences: { min: 0, max: 500 },
};

function validateLength(value, fieldName, errors) {
    const bounds = LENGTH_LIMITS[fieldName];
    if (!bounds || value === undefined || value === null) return;
    const len = String(value).trim().length;
    if (len === 0) return;
    if (len < bounds.min) {
        errors.push({
            field: fieldName,
            message: `${fieldName} must be at least ${bounds.min} characters (got ${len}).`,
        });
    } else if (len > bounds.max) {
        errors.push({
            field: fieldName,
            message: `${fieldName} must be under ${bounds.max} characters (got ${len}).`,
        });
    }
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const COLOR_NAME_RE = /^[a-zA-Z][a-zA-Z\s-]{1,29}$/;

// ---- File upload restrictions (per attachment type) ----
// Applied to the *URLs* the client sends after uploading to Supabase
// Storage — we can't check bytes here, but we CAN cap how many files
// per type are allowed, and reject URLs whose extension isn't in the
// allowed list for that type (belt-and-braces alongside whatever
// bucket-level restrictions Supabase itself enforces on upload).
const FILE_RULES = {
    FLOOR_PLAN: {
        maxCount: 5,
        maxSizeMB: 10,
        allowedExt: ["jpg",
            "jpeg",
            "png",
            "webp",
            "heic",
            "heif","pdf"],
    },
    PROPERTY_PHOTO: {
        maxCount: 15,
        maxSizeMB: 8,
        allowedExt: ["jpg",
            "jpeg",
            "png",
            "webp",
            "heic",
            "heif",],
    },
    REFERENCE_IMAGE: {
        maxCount: 15,
        maxSizeMB: 8,
        allowedExt: ["jpg",
            "jpeg",
            "png",
            "webp",
            "heic",
            "heif",],
    },
    VIDEO: {
        maxCount: 3,
        maxSizeMB: 100,
        allowedExt: ["mp4", "mov", "webm"],
    },
};

function getExtension(url) {
    const clean = url.split("?")[0].split("#")[0];
    const match = clean.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : "";
}

/**
 * Validates the *Urls arrays against FILE_RULES: count per type,
 * extension whitelist per type, and (if the client sends matching
 * *Sizes arrays, in bytes) size per file. Sizes are optional since
 * the URL alone doesn't carry byte size — if the frontend has it
 * (from the upload response) it should send it as e.g.
 * floorPlanSizes: [123456, 98765], same order as floorPlanUrls.
 */
function validateFileUploads(body, errors) {
    const FILE_FIELDS = [
        { urlField: "floorPlanUrls", sizeField: "floorPlanSizes", type: "FLOOR_PLAN" },
        { urlField: "propertyPhotoUrls", sizeField: "propertyPhotoSizes", type: "PROPERTY_PHOTO" },
        { urlField: "referenceImageUrls", sizeField: "referenceImageSizes", type: "REFERENCE_IMAGE" },
        { urlField: "videoUrls", sizeField: "videoSizes", type: "VIDEO" },
    ];

    FILE_FIELDS.forEach(({ urlField, sizeField, type }) => {
        const urls = body[urlField];
        if (!Array.isArray(urls) || urls.length === 0) return;

        const rules = FILE_RULES[type];
        const validUrls = urls.filter((u) => typeof u === "string" && u.trim() !== "");

        if (validUrls.length > rules.maxCount) {
            errors.push({
                field: urlField,
                message: `${type.replace(/_/g, " ")}: maximum ${rules.maxCount} files allowed (got ${validUrls.length}).`,
            });
        }

        validUrls.forEach((url, idx) => {
            const ext = getExtension(url);
            if (!rules.allowedExt.includes(ext)) {
                errors.push({
                    field: urlField,
                    message: `${type.replace(/_/g, " ")}: file ${idx + 1} has an unsupported type (.${ext || "unknown"}). Allowed: ${rules.allowedExt.join(", ")}.`,
                });
            }
        });

        const sizes = body[sizeField];
        if (Array.isArray(sizes)) {
            sizes.forEach((sizeBytes, idx) => {
                const num = Number(sizeBytes);
                if (Number.isNaN(num)) return;
                const maxBytes = rules.maxSizeMB * 1024 * 1024;
                if (num > maxBytes) {
                    errors.push({
                        field: urlField,
                        message: `${type.replace(/_/g, " ")}: file ${idx + 1} exceeds the ${rules.maxSizeMB}MB size limit.`,
                    });
                }
            });
        }
    });
}

function validateColorPreferences(value, errors) {
    if (!value) return;
    const entries = String(value).split(",").map((v) => v.trim()).filter(Boolean);
    const invalid = entries.filter((c) => !HEX_COLOR_RE.test(c) && !COLOR_NAME_RE.test(c));
    if (invalid.length) {
        errors.push({
            field: "colorPreferences",
            message: `Invalid color value(s): ${invalid.join(", ")}. Use a color name (e.g. "Red") or hex code (e.g. "#8A8F98").`,
        });
    }
}

// Helper function for pagination
const getPaginationParams = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

class ClientController {

    static async getProjectEnums(req, res) {
        try {
            return helper.success(res, "Enums fetched successfully", ENUMS);
        } catch (error) {
            return res.status(500).json({ success: false, message: "Failed to fetch enums" });
        }
    }

    static async getUserDetails(req, res, next) {
        try {
            const userId = req.user.id;

            const [user, projectStats] = await Promise.all([
                prisma.user.findUnique({
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
                        walletBalance: true,
                    },
                }),

                prisma.project.groupBy({
                    by: ["status"],
                    where: {
                        clientId: userId,
                    },
                    _count: {
                        status: true,
                    },
                }),
            ]);

            if (!user) {
                return helper.failed(res, "User not found");
            }

            const stats = {
                totalProjects: 0,
                activeProjects: 0,
                completedProjects: 0,
                pendingProjects: 0,
                cancelledProjects: 0,
            };

            projectStats.forEach((item) => {
                const count = item._count.status;

                stats.totalProjects += count;

                switch (item.status) {
                    case "IN_PROGRESS":
                        stats.activeProjects += count;
                        break;

                    case "COMPLETED":
                        stats.completedProjects += count;
                        break;

                    case "WAITING_FOR_QUOTATIONS":
                    case "PROPOSALS_RECEIVED":
                    case "HIRED":
                        stats.pendingProjects += count;
                        break;

                    case "CANCELLED":
                        stats.cancelledProjects += count;
                        break;
                }
            });

            const response = {
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
                projectStats: stats,
            };

            return helper.success(
                res,
                "User details fetched successfully",
                response
            );
        } catch (error) {
            next(error);
        }
    }


    static async createProject(req, res) {
        try {
            // SANITIZED: strip HTML from every free-text field on the body
            // before any validation runs, so length checks below apply to
            // the cleaned value (same pattern as authController).
            const body = sanitizeProjectBody(req.body);
            const errors = [];

            const required = [
                "title",
                "category",
                "servicesRequired",
                "description",
                "address",
                "city",
                "state",
                "pincode",
                "propertySize",
                "propertyStatus",
                "budgetMin",
                "budgetMax",
                "startDate",
                "completionDate",
            ];
            required.forEach((field) => {
                if (
                    body[field] === undefined ||
                    body[field] === null ||
                    body[field] === ""
                ) {
                    errors.push({ field, message: `${field} is required` });
                }
            });

            Object.keys(LENGTH_LIMITS).forEach((field) => {
                if (field === "colorPreferences") return;
                validateLength(body[field], field, errors);
            });

            validateEnum(body.category, ENUMS.category, "category", errors);
            validateEnum(
                body.servicesRequired,
                ENUMS.servicesRequired,
                "servicesRequired",
                errors
            );
            validateEnum(
                body.propertyStatus,
                ENUMS.propertyStatus,
                "propertyStatus",
                errors
            );
            validateEnum(body.designStyle, ENUMS.designStyle, "designStyle", errors);
            validateEnum(
                body.spaceRequirements,
                ENUMS.spaceRequirements,
                "spaceRequirements",
                errors
            );
            validateEnum(
                body.clientInvolvement,
                ENUMS.clientInvolvement,
                "clientInvolvement",
                errors
            );
            validateEnum(body.priority, ENUMS.priority, "priority", errors);
            validateEnum(
                body.preferredCommunication,
                ENUMS.preferredCommunication,
                "preferredCommunication",
                errors
            );

            validateColorPreferences(body.colorPreferences, errors);
            validateLength(body.colorPreferences, "colorPreferences", errors);

            if (
                body.propertyStatus === "NEW_CONSTRUCTION" &&
                (body.currentSpaceLikes || body.currentSpaceProblems)
            ) {
                errors.push({
                    field: "propertyStatus",
                    message: "currentSpaceLikes/currentSpaceProblems are not applicable for NEW_CONSTRUCTION",
                });
            }

            if (Number(body.budgetMin) > Number(body.budgetMax)) {
                errors.push({ field: "budgetMin", message: "budgetMin cannot be greater than budgetMax" });
            }

            // ---- Date validation (server-side, never trust client "today") ----
            const startDate = new Date(body.startDate);
            const completionDate = new Date(body.completionDate);
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            if (Number.isNaN(startDate.getTime())) {
                errors.push({ field: "startDate", message: "startDate is not a valid date" });
            } else if (startDate < todayStart) {
                errors.push({ field: "startDate", message: "startDate cannot be in the past" });
            }

            if (Number.isNaN(completionDate.getTime())) {
                errors.push({ field: "completionDate", message: "completionDate is not a valid date" });
            }

            if (
                !Number.isNaN(startDate.getTime()) &&
                !Number.isNaN(completionDate.getTime()) &&
                startDate > completionDate
            ) {
                errors.push({ field: "startDate", message: "startDate cannot be after completionDate" });
            }

            // ---- File upload restrictions (count / type / size) ----
            validateFileUploads(body, errors);

            if (errors.length) {
                return res.status(400).json({
                    success: false,
                    message: "Please fix the highlighted fields and try again.",
                    errors: errors.map((e) => e.message),
                    fieldErrors: errors,
                });
            }

            // ---- Build attachment records from Supabase Storage URL arrays ----
            const FILE_URL_FIELDS = [
                { field: "floorPlanUrls", type: "FLOOR_PLAN" },
                { field: "propertyPhotoUrls", type: "PROPERTY_PHOTO" },
                { field: "referenceImageUrls", type: "REFERENCE_IMAGE" },
                { field: "videoUrls", type: "VIDEO" },
            ];

            const attachmentData = FILE_URL_FIELDS.flatMap(({ field, type }) => {
                const urls = body[field];
                if (!Array.isArray(urls) || urls.length === 0) return [];
                return urls
                    .filter((url) => typeof url === "string" && url.trim() !== "")
                    .map((url) => ({ type, url }));
            });

            const project = await prisma.project.create({
                data: {
                    clientId: req.user.id,
                    title: body.title,
                    category: body.category,
                    servicesRequired: Array.isArray(body.servicesRequired)
                        ? body.servicesRequired
                        : [body.servicesRequired],
                    description: body.description,

                    address: body.address,
                    city: body.city,
                    state: body.state,
                    pincode: body.pincode,
                    propertySize: Number(body.propertySize),
                    numberOfFloors: body.numberOfFloors
                        ? Number(body.numberOfFloors)
                        : null,
                    numberOfBedrooms: body.numberOfBedrooms
                        ? Number(body.numberOfBedrooms)
                        : null,
                    numberOfBathrooms: body.numberOfBathrooms
                        ? Number(body.numberOfBathrooms)
                        : null,
                    propertyStatus: body.propertyStatus,

                    designStyle: body.designStyle
                        ? Array.isArray(body.designStyle)
                            ? body.designStyle
                            : [body.designStyle]
                        : [],
                    colorPreferences: body.colorPreferences || null,
                    spaceRequirements: body.spaceRequirements
                        ? Array.isArray(body.spaceRequirements)
                            ? body.spaceRequirements
                            : [body.spaceRequirements]
                        : [],
                    accessibilityNeeds: body.accessibilityNeeds || null,
                    spaceUsers: body.spaceUsers || null,
                    currentSpaceLikes: body.currentSpaceLikes || null,
                    currentSpaceProblems: body.currentSpaceProblems || null,
                    clientInvolvement: body.clientInvolvement || null,

                    budgetMin: new Prisma.Decimal(body.budgetMin),
                    budgetMax: new Prisma.Decimal(body.budgetMax),
                    startDate: new Date(body.startDate),
                    completionDate: new Date(body.completionDate),
                    priority: body.priority || "NORMAL",

                    siteVisitRequired: body.siteVisitRequired === "true" || body.siteVisitRequired === true,
                    preferredCommunication: body.preferredCommunication || null,
                    preferredWorkingHours: body.preferredWorkingHours || null,
                    additionalNotes: body.additionalNotes || null,

                    attachments: attachmentData.length
                        ? { create: attachmentData }
                        : undefined,
                },
                include: { attachments: true },
            });

            return res.status(201).json({ success: true, data: project });
        } catch (err) {
            console.error("========== createProject ERROR ==========");
            console.error("Error Message:", err.message);
            console.error("Error Stack:", err.stack);
            console.error("Full Error Object:", err);

            if (err.response) {
                console.error("Response Data:", err.response.data);
                console.error("Response Status:", err.response.status);
            }

            return res.status(500).json({
                success: false,
                message: "Failed to create project",
                error: err.message,
            });
        }
    }



    static async getProjectById(req, res) {
        try {
            const project = await prisma.project.findUnique({
                where: { id: req.params.id },
                include: { attachments: true },
            });

            if (!project) {
                return res
                    .status(404)
                    .json({ success: false, message: "Project not found" });
            }

            return res.json({ success: true, data: project });
        } catch (err) {
            console.error("getProjectById error:", err);
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch project" });
        }
    }

    // ======== UPDATED WITH PAGINATION ========


    static async listProjects(req, res) {
        try {
            const userId = req.user.id;
            const { category, service, status, city } = req.query;
            const { page, limit, skip } = getPaginationParams(req);

            const where = {
                clientId: userId,
            };

            if (category) where.category = category;
            if (status) where.status = status;
            if (city) where.city = city;
            if (service) where.servicesRequired = { has: service };

            const [projects, totalProjects] = await Promise.all([
                prisma.project.findMany({
                    where,
                    include: {
                        attachments: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    skip,
                    take: limit,
                }),
                prisma.project.count({ where }),
            ]);

            return res.json({
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
            console.error("listProjects error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to list projects",
            });
        }
    }


    static async updateProject(req, res) {
        try {
            const { projectId } = req.params;

            const existing = await prisma.project.findUnique({
                where: { id: projectId },
                include: { attachments: true },
            });

            if (!existing) {
                return res.status(404).json({ success: false, message: "Project not found" });
            }

            if (existing.clientId !== req.user.id) {
                return res.status(403).json({ success: false, message: "You are not allowed to edit this project" });
            }

            if (!["WAITING_FOR_QUOTATIONS", "PROPOSALS_RECEIVED"].includes(existing.status)) {
                return res.status(400).json({
                    success: false,
                    message: "This project can no longer be edited",
                });
            }

            const body = sanitizeProjectBody(req.body);
            const errors = [];

            Object.keys(LENGTH_LIMITS).forEach((field) => {
                if (field === "colorPreferences") return;
                if (body[field] !== undefined) validateLength(body[field], field, errors);
            });

            if (body.category !== undefined) validateEnum(body.category, ENUMS.category, "category", errors);
            if (body.servicesRequired !== undefined) validateEnum(body.servicesRequired, ENUMS.servicesRequired, "servicesRequired", errors);
            if (body.propertyStatus !== undefined) validateEnum(body.propertyStatus, ENUMS.propertyStatus, "propertyStatus", errors);
            if (body.designStyle !== undefined) validateEnum(body.designStyle, ENUMS.designStyle, "designStyle", errors);
            if (body.spaceRequirements !== undefined) validateEnum(body.spaceRequirements, ENUMS.spaceRequirements, "spaceRequirements", errors);
            if (body.clientInvolvement !== undefined) validateEnum(body.clientInvolvement, ENUMS.clientInvolvement, "clientInvolvement", errors);
            if (body.priority !== undefined) validateEnum(body.priority, ENUMS.priority, "priority", errors);
            if (body.preferredCommunication !== undefined) validateEnum(body.preferredCommunication, ENUMS.preferredCommunication, "preferredCommunication", errors);

            if (body.colorPreferences !== undefined) {
                validateColorPreferences(body.colorPreferences, errors);
                validateLength(body.colorPreferences, "colorPreferences", errors);
            }

            const nextPropertyStatus = body.propertyStatus ?? existing.propertyStatus;
            if (
                nextPropertyStatus === "NEW_CONSTRUCTION" &&
                (body.currentSpaceLikes || body.currentSpaceProblems || existing.currentSpaceLikes || existing.currentSpaceProblems)
            ) {
                errors.push({
                    field: "propertyStatus",
                    message: "currentSpaceLikes/currentSpaceProblems are not applicable for NEW_CONSTRUCTION",
                });
            }

            const nextBudgetMin = body.budgetMin !== undefined ? Number(body.budgetMin) : Number(existing.budgetMin);
            const nextBudgetMax = body.budgetMax !== undefined ? Number(body.budgetMax) : Number(existing.budgetMax);
            if (nextBudgetMin > nextBudgetMax) {
                errors.push({ field: "budgetMin", message: "budgetMin cannot be greater than budgetMax" });
            }

            let startDate = existing.startDate;
            let completionDate = existing.completionDate;

            if (body.startDate !== undefined) {
                startDate = new Date(body.startDate);
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                if (Number.isNaN(startDate.getTime())) {
                    errors.push({ field: "startDate", message: "startDate is not a valid date" });
                } else if (startDate < todayStart) {
                    errors.push({ field: "startDate", message: "startDate cannot be in the past" });
                }
            }

            if (body.completionDate !== undefined) {
                completionDate = new Date(body.completionDate);
                if (Number.isNaN(completionDate.getTime())) {
                    errors.push({ field: "completionDate", message: "completionDate is not a valid date" });
                }
            }

            if (
                !Number.isNaN(new Date(startDate).getTime()) &&
                !Number.isNaN(new Date(completionDate).getTime()) &&
                new Date(startDate) > new Date(completionDate)
            ) {
                errors.push({ field: "startDate", message: "startDate cannot be after completionDate" });
            }

            validateFileUploads(body, errors);

            if (errors.length) {
                return res.status(400).json({
                    success: false,
                    message: "Please fix the highlighted fields and try again.",
                    errors: errors.map((e) => e.message),
                    fieldErrors: errors,
                });
            }

            const FILE_URL_FIELDS = [
                { field: "floorPlanUrls", type: "FLOOR_PLAN" },
                { field: "propertyPhotoUrls", type: "PROPERTY_PHOTO" },
                { field: "referenceImageUrls", type: "REFERENCE_IMAGE" },
                { field: "videoUrls", type: "VIDEO" },
            ];

            // A type's attachments are only touched if the client sent a *Urls
            // array for it (including [] to mean "remove all of this type").
            const typesToReplace = FILE_URL_FIELDS.filter(({ field }) => Array.isArray(body[field])).map((f) => f.type);

            const newAttachmentData = FILE_URL_FIELDS.flatMap(({ field, type }) => {
                const urls = body[field];
                if (!Array.isArray(urls)) return [];
                return urls.filter((u) => typeof u === "string" && u.trim() !== "").map((url) => ({ type, url }));
            });

            const data = {};
            if (body.title !== undefined) data.title = body.title;
            if (body.category !== undefined) data.category = body.category;
            if (body.servicesRequired !== undefined) {
                data.servicesRequired = Array.isArray(body.servicesRequired) ? body.servicesRequired : [body.servicesRequired];
            }
            if (body.description !== undefined) data.description = body.description;
            if (body.address !== undefined) data.address = body.address;
            if (body.city !== undefined) data.city = body.city;
            if (body.state !== undefined) data.state = body.state;
            if (body.pincode !== undefined) data.pincode = body.pincode;
            if (body.propertySize !== undefined) data.propertySize = Number(body.propertySize);
            if (body.numberOfFloors !== undefined) data.numberOfFloors = body.numberOfFloors ? Number(body.numberOfFloors) : null;
            if (body.numberOfBedrooms !== undefined) data.numberOfBedrooms = body.numberOfBedrooms ? Number(body.numberOfBedrooms) : null;
            if (body.numberOfBathrooms !== undefined) data.numberOfBathrooms = body.numberOfBathrooms ? Number(body.numberOfBathrooms) : null;
            if (body.propertyStatus !== undefined) data.propertyStatus = body.propertyStatus;
            if (body.designStyle !== undefined) {
                data.designStyle = Array.isArray(body.designStyle) ? body.designStyle : [body.designStyle];
            }
            if (body.colorPreferences !== undefined) data.colorPreferences = body.colorPreferences || null;
            if (body.spaceRequirements !== undefined) {
                data.spaceRequirements = Array.isArray(body.spaceRequirements) ? body.spaceRequirements : [body.spaceRequirements];
            }
            if (body.accessibilityNeeds !== undefined) data.accessibilityNeeds = body.accessibilityNeeds || null;
            if (body.spaceUsers !== undefined) data.spaceUsers = body.spaceUsers || null;
            if (body.currentSpaceLikes !== undefined) data.currentSpaceLikes = body.currentSpaceLikes || null;
            if (body.currentSpaceProblems !== undefined) data.currentSpaceProblems = body.currentSpaceProblems || null;
            if (body.clientInvolvement !== undefined) data.clientInvolvement = body.clientInvolvement || null;
            if (body.budgetMin !== undefined) data.budgetMin = new Prisma.Decimal(body.budgetMin);
            if (body.budgetMax !== undefined) data.budgetMax = new Prisma.Decimal(body.budgetMax);
            if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
            if (body.completionDate !== undefined) data.completionDate = new Date(body.completionDate);
            if (body.priority !== undefined) data.priority = body.priority || "NORMAL";
            if (body.siteVisitRequired !== undefined) {
                data.siteVisitRequired = body.siteVisitRequired === "true" || body.siteVisitRequired === true;
            }
            if (body.preferredCommunication !== undefined) data.preferredCommunication = body.preferredCommunication || null;
            if (body.preferredWorkingHours !== undefined) data.preferredWorkingHours = body.preferredWorkingHours || null;
            if (body.additionalNotes !== undefined) data.additionalNotes = body.additionalNotes || null;

            if (typesToReplace.length) {
                data.attachments = {
                    deleteMany: { type: { in: typesToReplace } },
                    create: newAttachmentData,
                };
            }

            const updatedProject = await prisma.project.update({
                where: { id: projectId },
                data,
                include: { attachments: true },
            });

            return res.status(200).json({ success: true, message: "Project updated successfully", data: updatedProject });
        } catch (err) {
            console.error("updateProject error:", err);
            return res.status(500).json({ success: false, message: "Failed to update project", error: err.message });
        }
    }



    static async updateProjectAvailability(req, res) {
        try {
            const { projectId } = req.params;
            const { status } = req.body;

            if (!["OPEN", "CLOSED"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid availability status",
                });
            }

            const project = await prisma.project.findUnique({
                where: {
                    id: projectId,
                },
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found",
                });
            }

            const updatedProject = await prisma.project.update({
                where: {
                    id: projectId,
                },
                data: {
                    availabilityStatus: status,
                },
            });

            return res.status(200).json({
                success: true,
                message: "Project availability status updated successfully",
                data: updatedProject,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to update project availability status",
                error: error.message,
            });
        }
    }

    static async getProjectTeam(req, res) {
        try {
            const { projectId } = req.params;
            const team = await ProjectService.getProjectTeam(projectId, req.user);
            return helper.success(res, "Project team fetched successfully", team);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

    static async transitionProjectStatus(req, res) {
        try {
            const { projectId } = req.params;
            const { status, reason } = req.body;
            const updated = await ProjectService.transitionProjectStatus(projectId, status, req.user, reason, req);
            return helper.success(res, "Project status updated successfully", updated);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

    static async removeTeamMember(req, res) {
        try {
            const { projectId, memberId } = req.params;
            const { reason } = req.body;
            const removed = await ProjectService.removeTeamMember(projectId, memberId, req.user, reason, req);
            return helper.success(res, "Team member removed successfully", removed);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

}

export default ClientController;