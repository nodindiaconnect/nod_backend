import { Router } from "express";
import WalletController from "../controllers/walletController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Private Personal Wallet Details & Ledger
router.get("/me", Auth, WalletController.getMyWallet);

// Request Personal Wallet Withdrawal
router.post("/withdraw", Auth, WalletController.requestWithdrawal);

export default router;
