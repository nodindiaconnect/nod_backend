import { Router } from "express";
import UserController from "../../controllers/admin/userController.js";
import { Auth, verifyAdmin } from "../../middleware/authenticate.js";

const router = Router();

// Each of these accepts ?page=1&limit=10&search=term
// Get all clients
router.get(
  "/clients",
  //   Auth,
  //   verifyAdmin,
  UserController.getClientUsers
);

// Get all designers
router.get(
  "/designers",
  //   Auth,
  //   verifyAdmin,
  UserController.getDesignerUsers
);

// Get all architects
router.get(
  "/architects",
  //   Auth,
  //   verifyAdmin,
  UserController.getArchitectUsers
);

// Get all contractors
router.get(
  "/contractors",
  //   Auth,
  //   verifyAdmin,
  UserController.getContractorUsers
);

// Update user details
router.put(
  "/:id",
  //   Auth,
  //   verifyAdmin,
  UserController.updateUser
);

// Block user
router.patch(
  "/:id/block",
  //   Auth,
  //   verifyAdmin,
  UserController.blockUser
);

// Unblock user
router.patch(
  "/:id/unblock",
  //   Auth,
  //   verifyAdmin,
  UserController.unblockUser
);

// Delete user (soft delete)
router.delete(
  "/:id",
  //   Auth,
  //   verifyAdmin,
  UserController.deleteUser
);

export default router;


