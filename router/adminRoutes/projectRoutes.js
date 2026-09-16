import { Router } from "express";
import ProjectController from "../../controllers/admin/projectsController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

router.use(Auth, verifyAdmin, checkPermission("ALL_PROJECTS"));

router.get("/projects", ProjectController.getAllProjects);
router.get("/projects/:id", ProjectController.getProjectById);
router.patch("/projects/:id/status", ProjectController.updateProjectStatus);

export default router;
