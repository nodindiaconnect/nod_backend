import { Router } from "express";
import ContractorController from "../controllers/contractorController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.get("/userDetails", Auth, ContractorController.getUserDetails);

 
router.get("/me/overview", ContractorController.getOverview)
router.get("/me/quotations", ContractorController.getQuotations)
router.post("/quotations", ContractorController.sendQuotation)
router.patch("/quotations/:bidId/withdraw", ContractorController.withdrawQuotation)
router.get("/me/projects", ContractorController.getProjectsToBid)


export default router;