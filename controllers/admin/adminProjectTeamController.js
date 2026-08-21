import helper from "../../helper/helper.js";
import AdminManagementService from "../../services/adminManagementService.js";
import ProjectService from "../../services/projectService.js";

class AdminProjectTeamController {
    /**
     * Get all project teams across the system
     * GET /api/Admin/teams
     */
    static async getAllProjectTeams(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const skip = (page - 1) * limit;

            const result = await AdminManagementService.getProjectTeamsAdmin({
                page,
                limit,
                skip,
                projectId: req.query.projectId,
                role: req.query.role,
                status: req.query.status,
            });

            return helper.success(res, "Project teams fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get team members for a specific project
     * GET /api/Admin/teams/projects/:projectId
     */
    static async getTeamForProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const team = await ProjectService.getProjectTeam(projectId, req.admin);
            return helper.success(res, "Project team details fetched successfully", team);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Admin assign team member
     * POST /api/Admin/teams/projects/:projectId/assign
     */
    static async assignTeamMember(req, res, next) {
        try {
            const { projectId } = req.params;
            const { userId, role, bidId } = req.body;

            if (!userId || !role) {
                return helper.failed(res, "userId and role are required", {}, 400);
            }

            const teamMember = await AdminManagementService.adminAssignTeamMember(
                req.admin,
                projectId,
                { userId, role, bidId },
                req
            );

            return helper.success(res, "Team member assigned successfully by admin", teamMember);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Admin remove team member
     * DELETE /api/Admin/teams/projects/:projectId/members/:memberId
     */
    static async removeTeamMember(req, res, next) {
        try {
            const { projectId, memberId } = req.params;
            const { reason } = req.body;

            const removed = await ProjectService.removeTeamMember(
                projectId,
                memberId,
                req.admin,
                reason,
                req
            );

            return helper.success(res, "Team member removed successfully by admin", removed);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default AdminProjectTeamController;
