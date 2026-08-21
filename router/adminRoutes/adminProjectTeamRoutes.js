import { Router } from "express";
import AdminProjectTeamController from "../../controllers/admin/adminProjectTeamController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

// Apply Auth and verifyAdmin
router.use(Auth, verifyAdmin, checkPermission("ALL_PROJECTS"));

// Get all project teams across platform
router.get("/", AdminProjectTeamController.getAllProjectTeams);

// Get team members for a specific project
router.get("/projects/:projectId", AdminProjectTeamController.getTeamForProject);

// Assign team member
router.post("/projects/:projectId/assign", AdminProjectTeamController.assignTeamMember);

// Remove team member
router.delete("/projects/:projectId/members/:memberId", AdminProjectTeamController.removeTeamMember);

export default router;
