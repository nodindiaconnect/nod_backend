import { Router } from "express";
import BankController from "../controllers/bankController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

router.get("/", Auth, BankController.getBankDetails);
router.post("/", Auth, BankController.saveBankDetails);
router.put("/", Auth, BankController.saveBankDetails);

export default router;
