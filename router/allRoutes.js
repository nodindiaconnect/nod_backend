import { Router } from "express";
import AuthRouter from "../router/authRouter.js";
import DesignerRouter from "./DesingerRoutes.js";
import ClientRouter from "./clientRouter.js";
import ArchitechRouter from "./architechRouter.js";
import ContractorRouter from "./contractorRouter.js";
import AdminRouter from "./adminRoutes/adminAllRoutes.js";
import MaterialSupplier from "./materialSupplierRouter.js";
import contactRouter from "./contactRouter.js";
import PortfolioRouter from "./postFollowRouter.js";
import biddingRouter from "./biddingRouter.js";
import chatRoutes from "./chatRoutes.js";
import reviewRouter from "./reviewRouter.js";
import paymentRoutes from "./paymentRoutes.js";
import walletRoutes from "./walletRoutes.js";
import BankRouter from "./bankRouter.js";
import PaymentController from "../controllers/paymentController.js";
import helper from "../helper/helper.js";

let router = Router();

router.get("/", (req, res) => {
    return helper.success(res, "api are working");
});

// AdminRoutes
router.use("/Admin", AdminRouter);
router.use("/admin", AdminRouter);

// AuthRoutes
router.use("/Auth", AuthRouter);
router.use("/auth", AuthRouter);
router.use("/Client", ClientRouter);
router.use("/client", ClientRouter);
router.use("/Architech", ArchitechRouter);
router.use("/architech", ArchitechRouter);
router.use("/Contractor", ContractorRouter);
router.use("/contractor", ContractorRouter);
router.use("/materialSupplier", MaterialSupplier);
router.use("/contact", contactRouter);
router.use("/portfolio", PortfolioRouter);
router.use("/feed", (req, res, next) => {
    req.url = "/feed" + (req.url === "/" ? "" : req.url);
    return PortfolioRouter(req, res, next);
});
router.use("/follow", (req, res, next) => {
    req.url = "/follow" + (req.url === "/" ? "" : req.url);
    return PortfolioRouter(req, res, next);
});
router.use("/bids", biddingRouter);
router.use("/chat", chatRoutes);
router.use("/reviews", reviewRouter);
router.use("/payments", paymentRoutes);
router.use("/wallet", walletRoutes);
router.use("/Designer", DesignerRouter);
router.use("/designer", DesignerRouter);
router.use("/bank-details", BankRouter);

// Payment Webhook (exempt from user auth, verified via HMAC signature)
router.post("/webhooks/payments/razorpay", PaymentController.handleRazorpayWebhook);

export default router;
