import { Router } from "express";
import UserRouter from "./userRoutes.js";
import ProjectRouter from "./projectRoutes.js";
import adminUsersRouter from "./adminUserRoutes.js";
import AdminBiddingRouter from "./adminBiddingRoutes.js";
import AdminChatRouter from "./adminChatRoutes.js";
import AdminProjectTeamRouter from "./adminProjectTeamRoutes.js";
import AdminDashboardRouter from "./adminDashboardRoutes.js";
import AdminFinanceRouter from "./adminFinanceRoutes.js";
import helper from "../../helper/helper.js";

let router = Router();

router.get("/", (req, res) => {
    return helper.success(res, "Admin APIs are working");
});

// AdminRoutes
router.use("/Users", UserRouter);
router.use("/users", UserRouter);
router.use("/Projects", ProjectRouter);
router.use("/projects", ProjectRouter);
router.use("/adminUsers", adminUsersRouter);
router.use("/admin-users", adminUsersRouter);
router.use("/bids", AdminBiddingRouter);
router.use("/chats", AdminChatRouter);
router.use("/teams", AdminProjectTeamRouter);
router.use("/dashboard", AdminDashboardRouter);
router.use("/finance", AdminFinanceRouter);

export default router;
