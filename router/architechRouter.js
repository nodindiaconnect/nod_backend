import { Router } from "express";
import ArchitechController from "../controllers/architechController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/userDetails", Auth, ArchitechController.getUserDetails);


router.get("/me/overview", Auth,ArchitechController.getOverview)
router.get("/me/quotations",Auth, ArchitechController.getQuotations)
router.post("/quotations",Auth, ArchitechController.sendQuotation)
router.patch("/quotations/:bidId/withdraw",Auth, ArchitechController.withdrawQuotation)
router.get("/me/projects",Auth, ArchitechController.getProjectsToBid)
export default router;