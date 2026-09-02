import { Router } from "express";
import MaterialSupplierController from "../controllers/materialSupplierController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";

let router = Router();

router.get("/me/userDetails", Auth, MaterialSupplierController.getUserDetails);
router.get("/me/profile", Auth, MaterialSupplierController.getMyProfile);
router.patch("/me/profile", Auth, MaterialSupplierController.editMyProfile);

// ---------------- PRODUCTS ----------------
router.post("/create-products", Auth, MaterialSupplierController.createProduct);
router.get("/products", Auth, MaterialSupplierController.getAllProducts);
router.get("/products/:id", Auth, MaterialSupplierController.getProductById);
router.put("/products/:id", Auth, MaterialSupplierController.updateProduct);
router.delete("/products/:id", Auth, MaterialSupplierController.deleteProduct);

router.post("/contact-details", Auth, MaterialSupplierController.createContactDetails);
router.get("/contact-details", Auth, MaterialSupplierController.getContactDetails);
router.put("/contact-details", Auth, MaterialSupplierController.updateContactDetails);
router.delete("/contact-details", Auth, MaterialSupplierController.deleteContactDetails);

router.post("/public/products", MaterialSupplierController.getPublicProducts);
// router.get("/public/products", MaterialSupplierController.getPublicProducts);
router.get("/public/products/supplier/:supplierId", MaterialSupplierController.getProductsBySupplierId);
router.get("/public/geocode", MaterialSupplierController.geocodeLocation);

export default router;