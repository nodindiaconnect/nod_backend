import { Router } from "express";
import AuthController from "../controllers/authController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

router.post("/register", validation, AuthController.register);
router.post("/isVerify", validation, AuthController.isVerify);
router.post("/resendOtp", validation, rateLimiter, AuthController.resendOtp);
router.post("/login", validation, rateLimiter, AuthController.login);
router.post(
  "/forgotPassword",
  validation,
  rateLimiter,
  AuthController.forgotPassword,
);
router.post(
  "/resetPassword",
  validation,
  rateLimiter,
  AuthController.resetPassword,
);
router.post(
  "/changePassword",
  validation,
  Auth,
  rateLimiter,
  AuthController.changePassword,
);
router.post(
  "/changePasswordReq",
  validation,
  Auth,
  rateLimiter,
  AuthController.changePasswordReq,
);
router.post("/reCAPTCHAVerify", AuthController.capchta_verify);
router.post("/logout", Auth, AuthController.logout);
router.get("/refreshToken", AuthController.refreshToken);

router.get("/CheckUserName", AuthController.checkUsername);


export default router;
