

import bcrypt from "bcryptjs";
import JWT from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";
import emailService from "../helper/emailService.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes, matches email copy

class authController {

  // ── REGISTER ──────────────────────────────────────────────
  static async register(req, res, next) {
    try {
      let { name, username, phone, countryCode, email, password, role } = req.body;
      email = email.toLowerCase();

      const existing = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (existing && existing.isVerified) {
        return helper.failed(res, "Email already registered", { email });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let user;
      if (!existing) {
        user = await prisma.user.create({
          data: {
            name,
            username,
            phone,
            email,
            countryCode,
            password: hashedPassword,
            role,
            isVerified: false,
          },
        });
      } else {
        // unverified user retrying registration — refresh their details
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            countryCode,
            username,
            phone,
            role,
            password: hashedPassword,
          },
        });
      }

      // clear any previous register OTPs, then create a fresh one
      await prisma.otp.deleteMany({
        where: { userId: user.id, otpType: "register" },
      });

      const code = await helper.generateOTP();
      await prisma.otp.create({
        data: {
          userId: user.id,
          otpType: "register",
          otp: code,
          expireTime: new Date(Date.now() + OTP_EXPIRY_MS),
        },
      });

      await emailService.sendOtpMail(email, name, code, "register");

      return helper.success(res, "OTP sent to email", { email });
    } catch (error) {
      console.error(error);
      console.dir(error, { depth: null });
      return res.status(500).json({
        code: error.code,
        meta: error.meta,
        message: error.message,
      });
    }
  }

  // ── RESEND OTP (generic) ──────────────────────────────────
  static async resendOtp(req, res, next) {
    try {
      let { email, otpType } = req.body;
      email = email.toLowerCase();

      const user = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (!user) {
        return helper.failed(res, "Invalid email", { email });
      }

      await prisma.otp.deleteMany({
        where: { userId: user.id, otpType },
      });

      const code = await helper.generateOTP();
      await prisma.otp.create({
        data: {
          userId: user.id,
          otpType,
          otp: code,
          expireTime: new Date(Date.now() + OTP_EXPIRY_MS),
        },
      });

      await emailService.sendOtpMail(email, user.name, code, otpType);

      return helper.success(res, "OTP resent to email", { email });
    } catch (error) {
      next(error);
    }
  }

  // ── FORGOT PASSWORD (sends OTP) ───────────────────────────
  static async forgotPassword(req, res, next) {
    try {
      let { email } = req.body;
      email = email.toLowerCase();

      const user = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (!user) {
        return helper.failed(res, "Invalid email", { email });
      }

      await prisma.otp.deleteMany({
        where: { userId: user.id, otpType: "forgotPassword" },
      });

      const code = await helper.generateOTP();
      await prisma.otp.create({
        data: {
          userId: user.id,
          otpType: "forgotPassword",
          otp: code,
          expireTime: new Date(Date.now() + OTP_EXPIRY_MS),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { forgotReq: true },
      });

      await emailService.sendOtpMail(email, user.name, code, "forgotPassword");

      return helper.success(res, "OTP sent to email", { email });
    } catch (error) {
      next(error);
    }
  }

  // ── CHANGE PASSWORD REQUEST (logged-in user, sends OTP) ───
  static async changePasswordReq(req, res, next) {
    try {
      const userId = req.user.id; // assumes auth middleware sets req.user

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      await prisma.otp.deleteMany({
        where: { userId: user.id, otpType: "changePassword" },
      });

      const code = await helper.generateOTP();
      await prisma.otp.create({
        data: {
          userId: user.id,
          otpType: "changePassword",
          otp: code,
          expireTime: new Date(Date.now() + OTP_EXPIRY_MS),
        },
      });

      await emailService.sendOtpMail(user.email, user.name, code, "changePassword");

      return helper.success(res, "OTP sent to email", { email: user.email });
    } catch (error) {
      next(error);
    }
  }

  // ── isVerify ───────────────────────────────────────────────
  static async isVerify(req, res, next) {
    try {
      let { email, otpType, country, state, city, address, roleFields } = req.body;
      email = email.toLowerCase();

      const findEmail = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (!findEmail) {
        return helper.failed(res, "Invalid email", { email });
      }

      const findOTP = await prisma.otp.findFirst({
        where: { userId: findEmail.id, otpType },
      });

      if (!findOTP) {
        return helper.failed(res, "Invalid OTP", { email });
      }

      const submittedOtp = Number(req.body.otp);

      if (Number.isNaN(submittedOtp) || findOTP.otp !== submittedOtp) {
        return helper.failed(res, "Invalid OTP", { email });
      }

      if (otpType === "register") {
        if (findEmail.isVerified || new Date(findOTP.expireTime) < new Date()) {
          return helper.failed(
            res,
            findEmail.isVerified ? "User already verified" : "OTP expired"
          );
        }

        const loginTime = new Date();

        await prisma.user.update({
          where: { id: findEmail.id },
          data: {
            isVerified: true,
            loginTime,
            ...(country && { country }),
            ...(state && { state }),
            ...(city && { city }),
            ...(address && { address }),
            ...(roleFields && { profile: JSON.stringify(roleFields) }),
          },
        });

        const wallet = await prisma.wallet.findFirst({
          where: { userId: findEmail.id },
        });

        if (!wallet) {
          await prisma.wallet.create({
            data: {
              userId: findEmail.id,
              totalAvailableBalance: 0,
              createdBy: findEmail.id,
              updatedBy: findEmail.id,
            },
          });
        }

        const token = JWT.sign(
          {
            id: findEmail.id, loginTime, exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
          },
          process.env.JWT_SK,
        );

        // re-fetch to include the freshly-saved location/profile fields in the response
        let updatedUser = await prisma.user.findUnique({ where: { id: findEmail.id } });
        updatedUser.token = token;
        updatedUser.isVerified = true;

        await prisma.otp.delete({ where: { id: findOTP.id } });

        return helper.success(res, "User verified successfully", updatedUser);
      } else {
        if (!findEmail.forgotReq || new Date(findOTP.expireTime) < new Date()) {
          return helper.failed(
            res,
            findEmail.forgotReq ? "Session expired" : "OTP expired"
          );
        }

        return helper.success(res, "OTP verified successfully", { email });
      }
    } catch (error) {
      next(error);
    }
  }

  // ── LOGIN ──────────────────────────────────────────────────
  static async login(req, res, next) {
    try {
      let { email, password, phone } = req.body;

      if (email) email = email.toLowerCase();

      const login__id = email ? { email } : { phone };

      const findUser = await prisma.user.findFirst({
        where: email
          ? { email, isDeleted: false }
          : { phone, isDeleted: false },
      });

      if (!findUser) {
        return helper.failed(
          res,
          `We couldn't find an account with this ${email ? "email address" : "phone number"
          }. Please check and try again.`,
          login__id
        );
      }

      // Check verification
      if (!findUser.isVerified) {
        if (email) {
          await prisma.user.delete({ where: { email } });
        }

        return helper.failed(
          res,
          "User not verified. Please create an account.",
          login__id
        );
      }

      // Check blocked
      if (findUser.isBlocked) {
        return helper.failed(res, "Account Blocked By Admin", login__id);
      }

      // Verify password
      const matched = bcrypt.compareSync(password, findUser.password);

      if (!matched) {
        return helper.failed(res, "Invalid password", login__id);
      }

      // Update login time
      const loginTime = new Date();
      await prisma.user.update({
        where: { id: findUser.id },
        data: { loginTime },
      });

      // Fetch updated user (selected fields)
      let updatedUser = await prisma.user.findUnique({
        where: { id: findUser.id },
        select: {
          name: true,
          email: true,
          role: true,
          username: true,
          phone: true,
          countryCode: true,
          city: true,
          state: true,
          country: true,
          address: true,
          walletBalance: true,
        },
      });

      // Generate JWT
      const token = JWT.sign(
        {
          id: findUser.id,
          loginTime,
          exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
        },
        process.env.JWT_SK
      );

      updatedUser.token = token;

      return helper.success(res, "User Login Successful", updatedUser);
    } catch (error) {
      next(error);
    }
  }

  // ── REFRESH TOKEN ────────────────────────────────────────────
  static async refreshToken(req, res, next) {
    console.log("triggeredrefreshtoken")
    try {
      const authHeader = req.headers["authorization"];
      const expiredToken = authHeader && authHeader.split(" ")[1];

      if (!expiredToken) {
        return res.status(401).json({ message: "Refresh Token is required" });
      }

      const decoded = JWT.decode(expiredToken);
      if (!decoded) {
        return res.status(403).json({ message: "Invalid Refresh Token" });
      }

      JWT.verify(expiredToken, process.env.JWT_SK, (err) => {
        if (err && err.name !== "TokenExpiredError") {
          return res.status(403).json({ message: "Invalid Refresh Token" });
        }

        const token = JWT.sign(
          { id: decoded.id, exp: Math.floor(Date.now() / 1000) + 60 * 15 }, // 15 minutes
          process.env.JWT_SK
        );

        return helper.success(res, "Refresh Token Generated Successfully", {
          token,
        });
      });
    } catch (error) {
      next(error);
    }
  }

  // ── RESET PASSWORD ────────────────────────────────────────────
  static async resetPassword(req, res, next) {
    try {
      let { email, newPassword } = req.body;
      email = email.toLowerCase();

      const findEmail = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (!findEmail) {
        return helper.failed(res, "Invalid email", { email });
      }
      if (!findEmail.forgotReq) {
        return helper.failed(res, "Session Expired", { email });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: findEmail.id },
        data: { forgotReq: false, password: hashedPassword },
      });

      return helper.success(res, `Password Updated Successfully`, { email });
    } catch (error) {
      next(error);
    }
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────────
  static async changePassword(req, res, next) {
    try {
      const { newPassword } = req.body;
      const requesterEmail = req.user ? req.user.email : req.admin.email;

      const findEmail = await prisma.user.findFirst({
        where: { email: requesterEmail, isDeleted: false },
      });

      if (!findEmail) {
        return helper.failed(res, "User not found");
      }

      const isSamePassword = bcrypt.compareSync(newPassword, findEmail.password);

      if (isSamePassword) {
        return helper.failed(
          res,
          "New password cannot be the same as the old password"
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: findEmail.id },
        data: { password: hashedPassword },
      });

      return helper.success(res, `Password Updated Successfully`);
    } catch (error) {
      next(error);
    }
  }

  // ── CAPTCHA VERIFY ────────────────────────────────────────────
  static async capchta_verify(req, res, next) {
    try {
      let { response } = req.body;
      const axiosRes = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        new URLSearchParams({
          secret: process.env.GOOGLE_RECAPTCHA_SECRET_KEY,
          response: response.toString(),
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      return res.json(axiosRes.data);
    } catch (error) {
      console.log(error);
      return helper.err(res, error, req.path);
    }
  }

  // ── LOGOUT ────────────────────────────────────────────────────
  static async logout(req, res, next) {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { loginTime: null },
      });
      return helper.success(res, `Logout Successfully`, {});
    } catch (error) {
      next(error);
    }
  }


  static async checkUsername(req, res, next) {
    try {
      const { username } = req.query;

      // Check if username exists and has at least 3 characters
      if (!username || username.trim().length < 3) {
        return res.status(400).json({
          available: false,
          message: "Username must be at least 3 characters",
        });
      }

      // Remove spaces and convert to lowercase
      const normalized = username.trim().toLowerCase();

      // Validate username format
      if (!/^[a-z0-9_.]+$/.test(normalized)) {
        return res.status(200).json({
          available: false,
          message:
            "Username can only contain letters, numbers, underscores and dots",
        });
      }

      // Check whether username already exists using Prisma
      const existingUser = await prisma.user.findUnique({
        where: {
          username: normalized,
        },
        select: {
          id: true,
        },
      });

      // Return availability status
      return res.status(200).json({
        available: !existingUser,
        message: existingUser
          ? "Username is already taken"
          : "Username is available",
      });
    } catch (err) {
      console.error("checkUsername error:", err);

      return res.status(500).json({
        available: false,
        message: "Could not check username",
      });
    }
  }
}

export default authController;

