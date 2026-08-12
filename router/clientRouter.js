import { Router } from "express";
import ClientController from "../controllers/clientController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/userDetails", Auth, ClientController.getUserDetails);

router.post("/createProject", Auth, ClientController.createProject);

router.get("/clientprojects", Auth, ClientController.listProjects);

router.get("/projects/:id", Auth, ClientController.getProjectById);

router.get("/projectEnums", Auth, ClientController.getProjectEnums);

router.post("/projects/:projectId/availability-status", ClientController.updateProjectAvailability
);

export default router;