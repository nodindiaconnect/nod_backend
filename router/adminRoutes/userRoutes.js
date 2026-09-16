import { Router } from "express";
import UserController from "../../controllers/admin/userController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

// Apply Auth, verifyAdmin, and ALL_USERS permission check across all user management routes
router.use(Auth, verifyAdmin, checkPermission("ALL_USERS"));

// Each of these accepts ?page=1&limit=10&search=term
// Get all clients
router.get("/clients", UserController.getClientUsers);

// Get all designers
router.get("/designers", UserController.getDesignerUsers);

// Get all architects
router.get("/architects", UserController.getArchitectUsers);

// Get all contractors
router.get("/contractors", UserController.getContractorUsers);

// Update user details
router.put("/:id", UserController.updateUser);

// Block user
router.patch("/:id/block", UserController.blockUser);

// Unblock user
router.patch("/:id/unblock", UserController.unblockUser);

// Delete user (soft delete)
router.delete("/:id", UserController.deleteUser);

export default router;


