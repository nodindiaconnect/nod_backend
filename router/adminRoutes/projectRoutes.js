import { Router } from "express";
import ProjectController from "../../controllers/admin/projectsController.js";
let router = Router();



router.get("/projects", ProjectController.getAllProjects);
router.get("/projects/:id", ProjectController.getProjectById);
router.patch("/projects/:id/status", ProjectController.updateProjectStatus);

export default router;
