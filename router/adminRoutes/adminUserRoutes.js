// routes/adminUserRoutes.js
import { Router } from "express";
import AdminUserController from "../../controllers/admin/adminuserController.js";
// import validation from "../helper/validation.js";
import { Auth ,verifyAdmin} from "../../middleware/authenticate.js";

const router = Router();

router.post("/create-admin-user", Auth,verifyAdmin, AdminUserController.createAdminUser);
router.get("/get-admin-users",Auth,verifyAdmin,  AdminUserController.getAdminUsers);
router.get("/viewUser/:userId", Auth,verifyAdmin,AdminUserController.viewAdminUser);
router.post("/edit-admin-user", Auth,verifyAdmin,  AdminUserController.updateAdminUser);
router.post("/userBlock",Auth,verifyAdmin, AdminUserController.blockAdminUser);

export default router;