import { Router } from "express";
import AuthController from "../controllers/authController.js";
import CategoryController from "../controllers/categoryController.js";
import validation from "../helper/validation.js";
import { Auth, verifyAdmin, verifyUser } from "../middleware/authenticate.js";
import { rateLimiter } from "../helper/rateLimit.js";

let router = Router();

// ── CATEGORIES & SPECIALIZATIONS (public for registration) ───
router.get("/categories-specializations", CategoryController.getCategoriesAndSpecializations);
router.get("/categories", CategoryController.getCategoriesAndSpecializations);

// ── REGISTER (multi-step flow) ──────────────────────────────
router.post("/register/start", AuthController.registerStart);
router.post("/register/verify-otp", AuthController.registerVerifyOtp);
router.post("/register/create-account", validation, AuthController.registerCreateAccount);
router.post("/register/finish", validation, AuthController.registerFinish);

// ── RESEND OTP (session-token based, not raw email) ─────────
router.post("/resendOtp", validation, rateLimiter, AuthController.resendOtp);

// ── LOGIN ────────────────────────────────────────────────────
router.post("/login", AuthController.login);
router.post("/adminLogin", AuthController.adminLogin);


// ── FORGOT / RESET PASSWORD (multi-step flow) ───────────────
router.post("/forgotPassword/start", validation, rateLimiter, AuthController.forgotStart);
router.post("/forgotPassword/verify-otp", validation, rateLimiter, AuthController.forgotVerifyOtp);
router.post("/resetPassword", validation, AuthController.resetPassword);

// ── CHANGE PASSWORD (logged-in user) ────────────────────────
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

// ── MISC ─────────────────────────────────────────────────────
router.post("/reCAPTCHAVerify", rateLimiter, AuthController.verifyCaptcha);
router.post("/logout", Auth, AuthController.logout);
router.get("/refreshToken", AuthController.refreshToken);
router.get("/CheckUserName", AuthController.checkUsername);
router.get("/currency", AuthController.getCurrency);

export default router;