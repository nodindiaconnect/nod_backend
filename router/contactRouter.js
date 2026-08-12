// import { Router } from "express";
// import ContactController from "../controllers/contactController.js";


// let router = Router();

// router.post("/contact-team", ContactController.submitContactLead);


// export default router;


import { Router } from "express";
import ContactController from "../controllers/contactController.js";

const router = Router();

router.post("/leads/popup", ContactController.submitPopupLead);
router.post("/leads/contact", ContactController.submitContactSectionLead);

export default router;

