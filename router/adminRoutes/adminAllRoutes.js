import { Router } from "express";
import UserRouter  from "./userRoutes.js"
import ProjectRouter from "./projectRoutes.js"
import adminUsersRouter from "./adminUserRoutes.js"
let router = Router();

// chatbotRoutes#########################################
// router.use("/ai", aiChatBot );

router.get("/", (req, res) => {
    return helper.success(res, "api are working");
});

// AdminRoutes###########################################
router.use("/Users", UserRouter);
router.use("/Projects", ProjectRouter);
router.use("/adminUsers", adminUsersRouter);

export default router;
