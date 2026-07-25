import { Router } from "express";
import DesignerController from "../controllers/DesignerController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/me/userDetails", Auth, DesignerController.getUserDetails);

router.get("/me/quotations", Auth, DesignerController.getQuotations)
router.post("/quotations", Auth, DesignerController.sendQuotation)
router.patch("/quotations/:bidId/withdraw", Auth, DesignerController.withdrawQuotation)
router.get("/me/projects", Auth, DesignerController.getProjectsToBid)

export default router;