import { Router } from "express";
import ContractorController from "../controllers/contractorController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/userDetails", Auth, ContractorController.getUserDetails);

router.get("/me/profile", Auth, ContractorController.getMyProfile);
router.patch("/me/profile", Auth, ContractorController.editMyProfile);

router.get("/me/overview", Auth, ContractorController.getOverview);
router.get("/me/quotations", Auth, ContractorController.getQuotations);
router.post("/quotations", Auth, ContractorController.sendQuotation);
router.patch("/quotations/:bidId/withdraw", Auth, ContractorController.withdrawQuotation);
router.get("/me/projects", Auth, ContractorController.getProjectsToBid);

export default router;