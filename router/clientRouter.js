import { Router } from "express";
import ClientController from "../controllers/clientController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/userDetails", Auth, ClientController.getUserDetails);
router.get("/dashboardStats", Auth, ClientController.getDashboardStats);

router.post("/createProject", Auth, ClientController.createProject);

router.get("/clientprojects", Auth, ClientController.listProjects);

router.get("/projects/:id", Auth, ClientController.getProjectById);

router.get("/projectEnums", ClientController.getProjectEnums);
router.put("/projects/:projectId", Auth, ClientController.updateProject);
router.post("/projects/:projectId/availability-status", Auth, ClientController.updateProjectAvailability);

router.get("/projects/:projectId/team", Auth, ClientController.getProjectTeam);
router.patch("/projects/:projectId/status", Auth, ClientController.transitionProjectStatus);
router.delete("/projects/:projectId/team/:memberId", Auth, ClientController.removeTeamMember);

export default router;