// controllers/admin/projectController.js
import prisma from "../../config/prismaClient.js";

const VALID_PROJECT_STATUSES = [
    "DRAFT",
    "PUBLISHED",
    "BIDDING_OPEN",
    "WAITING_FOR_QUOTATIONS",
    "PROPOSALS_RECEIVED",
    "ROLE_SELECTED",
    "SELECTED",
    "HIRED",
    "PAYMENT_REQUIRED",
    "IN_PROGRESS",
    "IN_PROGRESS_PLANNING",
    "IN_PROGRESS_CONSTRUCTION",
    "IN_PROGRESS_INTERIORS",
    "COMPLETED",
    "CANCELLED",
];

class ProjectController {

    static async getAllProjects(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
            const skip = (page - 1) * limit;
            const search = (req.query.search || "").trim();
            const status = (req.query.status || "").trim();

            const where = { isDeleted: false };

            if (status && VALID_PROJECT_STATUSES.includes(status)) {
                where.status = status;
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: "insensitive" } },
                    { city: { contains: search, mode: "insensitive" } },
                    { state: { contains: search, mode: "insensitive" } },
                    { client: { name: { contains: search, mode: "insensitive" } } },
                ];
            }

            const [projects, total] = await Promise.all([
                prisma.project.findMany({
                    where,
                    include: {
                        client: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                prisma.project.count({ where }),
            ]);

            return res.status(200).json({
                success: true,
                message: "Projects fetched successfully",
                data: projects,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                },
            });
        } catch (error) {
            console.error("getAllProjects error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch projects",
            });
        }
    }

    static async getProjectById(req, res) {
        try {
            const { id } = req.params;

            const project = await prisma.project.findFirst({
                where: { id, isDeleted: false },
                include: {
                    client: {
                        select: { id: true, name: true, email: true, phone: true },
                    },
                    attachments: true,
                    awards: {
                        include: {
                            contract: {
                                include: { milestones: true },
                            },
                            bid: true,
                        },
                    },
                    teamMembers: true,
                    escrow: true,
                },
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Project fetched successfully",
                data: project,
            });
        } catch (error) {
            console.error("getProjectById error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch project",
            });
        }
    }

    static async updateProjectStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status || !VALID_PROJECT_STATUSES.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Allowed values: ${VALID_PROJECT_STATUSES.join(", ")}`,
                });
            }

            const project = await prisma.project.findFirst({
                where: { id, isDeleted: false },
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found",
                });
            }

            const updatedProject = await prisma.project.update({
                where: { id },
                data: { status },
            });

            return res.status(200).json({
                success: true,
                message: "Project status updated successfully",
                data: updatedProject,
            });
        } catch (error) {
            console.error("updateProjectStatus error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update project status",
            });
        }
    }
}

export default ProjectController;