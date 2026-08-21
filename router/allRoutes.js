import { Router } from "express";
import AuthRouter from "../router/authRouter.js";
import DesignerRouter from "./DesingerRoutes.js";
import ClientRouter from "./clientRouter.js"
import ArchitechRouter from "./architechRouter.js"
import ContractorRouter from "./contractorRouter.js"
import AdminRouter from "./adminRoutes/adminAllRoutes.js"
import MaterialSupplier from "./materialSupplierRouter.js"
import contactRouter from "./contactRouter.js"
import PortfolioRouter from "./postFollowRouter.js"
import biddingRouter from "./biddingRouter.js";
import chatRoutes from "./chatRoutes.js";
import reviewRouter from "./reviewRouter.js";
import helper from "../helper/helper.js";

let router = Router();

// chatbotRoutes#########################################
// router.use("/ai", aiChatBot );

router.get("/", (req, res) => {
    return helper.success(res, "api are working");
});

// AdminRoutes###########################################
router.use("/Admin", AdminRouter);

// AuthRoutes############################################
router.use("/Auth", AuthRouter);
router.use("/Client", ClientRouter);
router.use("/Architech", ArchitechRouter);
router.use("/Contractor", ContractorRouter);
router.use("/materialSupplier", MaterialSupplier);
router.use("/contact", contactRouter);
router.use("/portfolio", PortfolioRouter);
router.use("/bids", biddingRouter);
router.use("/chat", chatRoutes);
router.use("/reviews", reviewRouter);

router.use("/Designer", DesignerRouter);
export default router;


