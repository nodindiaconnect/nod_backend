import { Router } from "express";
import ContactController from "../controllers/contactController.js";


let router = Router();

router.post("/contact-team", ContactController.submitContactLead);


export default router;