// import { Router } from "express";
// import ContactController from "../controllers/contactController.js";


// let router = Router();

// router.post("/contact-team", ContactController.submitContactLead);


// export default router;


import { Router } from "express";
import ContactController from "../controllers/contactController.js";
import { rateLimiter } from "../helper/rateLimit.js";

const router = Router();

router.post("/leads/popup", rateLimiter, ContactController.submitPopupLead);
router.post("/leads/contact", rateLimiter, ContactController.submitContactSectionLead);

export default router;

