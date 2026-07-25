import { Router } from "express";
import UserRouter  from "./userRoutes.js"
let router = Router();

// chatbotRoutes#########################################
// router.use("/ai", aiChatBot );

router.get("/", (req, res) => {
    return helper.success(res, "api are working");
});

// AdminRoutes###########################################
router.use("/Users", UserRouter);

export default router;
