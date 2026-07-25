import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

import pkg from "@prisma/client";
const { Prisma } = pkg;


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
    preferredCommunication: ["CHAT", "PHONE", "VIDEO_CALL"],
    attachmentType: ["FLOOR_PLAN", "PROPERTY_PHOTO", "REFERENCE_IMAGE", "VIDEO"],
};

function validateEnum(value, allowed, fieldName, errors) {
    if (value === undefined || value === null) return;
    const values = Array.isArray(value) ? value : [value];
    const invalid = values.filter((v) => !allowed.includes(v));
    if (invalid.length) {
        errors.push(`${fieldName}: invalid value(s) ${invalid.join(", ")}`);
    }
}

class ClientController {

    static async getUserDetails(req, res, next) {
        try {
            const userId = req.user.id;

            console.log(userId,"userId1q2w34")

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

            return helper.success(
                res,
                "User details fetched successfully",
                {
                    ...user,
                    projectStats: stats,
                }
            );
        } catch (error) {
            next(error);
        }
    }



    static async createProject(req, res) {
        try {
            const body = req.body;
            const errors = [];

            // ---- Required field checks (Step 1, 2, 4) ----
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
                    errors.push(`${field} is required`);
                }
            });


            // ---- Enum validation ----
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

            // ---- Cross-field logic ----
            // currentSpaceLikes / currentSpaceProblems only make sense if not new construction
            if (
                body.propertyStatus === "NEW_CONSTRUCTION" &&
                (body.currentSpaceLikes || body.currentSpaceProblems)
            ) {
                errors.push(
                    "currentSpaceLikes/currentSpaceProblems are not applicable for NEW_CONSTRUCTION"
                );
            }

            if (Number(body.budgetMin) > Number(body.budgetMax)) {
                errors.push("budgetMin cannot be greater than budgetMax");
            }

            if (new Date(body.startDate) > new Date(body.completionDate)) {
                errors.push("startDate cannot be after completionDate");
            }

            if (errors.length) {
                return res.status(400).json({ success: false, errors });
            }

            // ---- Build attachment records from Supabase Storage URLs ----
            // Files are uploaded directly to Supabase Storage from the
            // frontend (see ProjectsPage.jsx / superBase.js). By the time
            // this request arrives, req.body already contains the public
            // URLs for each uploaded file type — there is no local file on
            // disk and req.files will always be empty, so we must NOT rely
            // on multer here.
            const FILE_URL_FIELDS = [
                { field: "floorPlanUrl", type: "FLOOR_PLAN" },
                { field: "propertyPhotoUrl", type: "PROPERTY_PHOTO" },
                { field: "referenceImageUrl", type: "REFERENCE_IMAGE" },
                { field: "videoUrl", type: "VIDEO" },
            ];

            const attachmentData = FILE_URL_FIELDS.filter(
                ({ field }) => body[field]
            ).map(({ field, type }) => ({
                type,
                url: body[field],
            }));

            const project = await prisma.project.create({
                data: {
                    clientId: req.user.id, // assumes auth middleware sets req.user
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


    static async listProjects(req, res) {
    try {
        const userId = req.user.id;
        const { category, service, status, city } = req.query;

        const where = {
            clientId: userId,
        };

        if (category) where.category = category;
        if (status) where.status = status;
        if (city) where.city = city;
        if (service) where.servicesRequired = { has: service };

        const projects = await prisma.project.findMany({
            where,
            include: {
                attachments: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.json({
            success: true,
            data: projects,
        });
    } catch (err) {
        console.error("listProjects error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to list projects",
        });
    }
}



}


export default ClientController;