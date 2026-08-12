// controllers/admin/projectController.js
import prisma from "../../config/prismaClient.js";

class ProjectController {

    static async getAllProjects(req, res) {
        try {
            const projects = await prisma.project.findMany({
                where: { isDeleted: false },
                orderBy: { createdAt: "desc" },
            });

            return res.status(200).json({
                success: true,
                message: "Projects fetched successfully",
                data: projects,
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

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: "Status is required",
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