import bcrypt from "bcryptjs";
import axios from "axios";
import JWT from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";
import emailService from "../helper/emailService.js";
import sessionStore from "../helper/Sessionstore.js";
import sanitizeData from "../utils/sanitizeHtml.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidUsername,
  isValidPassword,
  isValidText,
} from "../utils/validators.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "dummy-password-for-timing-safety-only",
  10,
);

const allPermissions = [
  "DASHBOARD",
  "ALL_USERS",
  "ADMIN_USERS",
  "ALL_PROJECTS",
  "BIDS",
  "PRODUCTS",
  "CATEGORIES",
  "FEATURED_PRODUCTS",
  "WALLETS",
  "TRANSACTIONS",
  "PROMOTIONS",
  "REVIEWS",
  "COMPLAINTS",
  "NOTIFICATIONS",
  "SETTINGS",
];

// Server owns this map. Client sends the role NAME as a string
// ("Client" / "Designer" / etc). Anything not an exact key here is
// rejected — no numbers, no case-insensitive matching, no guessing.
const ACCOUNT_TYPES = {
  Admin: 0,
  Client: 1,
  Designer: 2,
  Architect: 3,
  Contractor: 4,
  MaterialSupplier: 5,
  subAdmin: 7,
};

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const LOCKED_MESSAGE = "Too many failed attempts. Please try again later.";
const GENERIC_REGISTER_MESSAGE =
  "If this email can be registered, a verification code has been sent.";
const GENERIC_RESEND_MESSAGE =
  "If this session is still active, a new OTP has been sent.";
const GENERIC_FORGOT_MESSAGE =
  "If an account exists with this email, a verification code has been sent.";
const GENERIC_OTP_FAIL = "Invalid or expired OTP.";
const GENERIC_SESSION_FAIL = "This session has expired. Please start again.";
const GENERIC_SERVER_ERROR = "Something went wrong. Please try again later.";
const CAPTCHA_FAIL_MESSAGE = "Captcha verification failed. Please try again.";

// authController.js — add near ACCOUNT_TYPES

// Mirrors the frontend's ROLE_FIELDS (authShared.js) so profile data
// submitted at register/create-account is validated server-side too.
// Keys are the numeric role codes from ACCOUNT_TYPES, since by this
// step the user's role is already fixed in the DB — we validate
// against what they registered as, not anything the client claims.
const ROLE_FIELD_SCHEMAS = {
  [ACCOUNT_TYPES.Client]: [],
  [ACCOUNT_TYPES.Designer]: [
    { id: "bio", type: "textarea", required: false, max: 1000 },
    { id: "category", type: "category", required: true },
    { id: "specialization", type: "specialization", required: true },
    {
      id: "style",
      type: "select",
      required: false,
      options: [
        "Modern",
        "Minimalist",
        "Luxury",
        "Scandinavian",
        "Industrial",
        "Eclectic",
      ],
    },
    { id: "experience", type: "number", required: false, min: 0, max: 80 },
    { id: "rate", type: "number", required: false, min: 0, max: 100000 },
  ],
  [ACCOUNT_TYPES.Architect]: [
    { id: "bio", type: "textarea", required: false, max: 1000 },
    {
      id: "specialization",
      type: "select",
      required: false,
      options: [
        "Residential",
        "Commercial",
        "Mixed-Use",
        "Industrial",
        "Urban Planning",
      ],
    },
    {
      id: "software",
      type: "select",
      required: false,
      options: ["AutoCAD", "Revit", "ArchiCAD", "SketchUp", "Rhino"],
    },
    { id: "experience", type: "number", required: false, min: 0, max: 80 },
  ],
  [ACCOUNT_TYPES.Contractor]: [
    { id: "bio", type: "textarea", required: false, max: 1000 },
    {
      id: "trade",
      type: "select",
      required: false,
      options: [
        "General Contractor",
        "Electrical",
        "Plumbing",
        "Carpentry",
        "Masonry",
        "Painting",
        "HVAC",
      ],
    },
    { id: "experience", type: "number", required: false, min: 0, max: 80 },
  ],
  [ACCOUNT_TYPES.MaterialSupplier]: [
    { id: "businessName", type: "text", max: 150 },
    { id: "ownerName", type: "text", max: 150 },
    {
      id: "businessType",
      type: "select",
      options: [
        "Manufacturer",
        "Wholesaler",
        "Retailer",
        "Distributor",
        "Importer",
      ],
    },
  ],
};

/**
 * Validates roleFields against the schema for the user's actual DB
 * role. Strips any key not in the schema, enforces required/type/
 * length/option constraints. Returns { ok, cleaned } or { ok:false, message }.
 */
async function validateRoleFields(roleCode, roleFields) {
  const schema = ROLE_FIELD_SCHEMAS[roleCode];
  if (!schema) return { ok: false, message: "Invalid account type." };

  const input = roleFields && typeof roleFields === "object" ? roleFields : {};
  const cleaned = {};

  for (const field of schema) {
    const raw = input[field.id];
    const isEmpty = raw === undefined || raw === null || raw === "";

    if (field.required && isEmpty) {
      if (field.type === "category") return { ok: false, message: "Category is required." };
      if (field.type === "specialization") return { ok: false, message: "Specialization is required." };
      return { ok: false, message: `${field.id} is required.` };
    }
    if (isEmpty) continue; // optional and not provided — skip

    if (field.type === "category") {
      const rawStr = String(raw).replace(/&amp;/g, "&").trim();
      console.log(rawStr,"rawStr1")
      let cat = await prisma.category.findFirst({
        where: {
          OR: [
            { id: rawStr },
            { name: { equals: rawStr, mode: "insensitive" } },
            { id: String(raw) },
            { name: { equals: String(raw).trim(), mode: "insensitive" } },
          ],
        },
      });
      if (!cat) {
        const allCats = await prisma.category.findMany();
        const found = allCats.find(
          (c) =>
            c.id === rawStr ||
            c.name.trim().toLowerCase() === rawStr.toLowerCase() ||
            c.id === String(raw) ||
            c.name.trim().toLowerCase() === String(raw).trim().toLowerCase()
        );
        if (found) {
          cleaned[field.id] = found.name;
        } else {
          return { ok: false, message: "Selected category does not exist." };
        }
      } else {
        cleaned[field.id] = cat.name;
      }
    } else if (field.type === "specialization") {
      const categoryVal = String(input.category || cleaned.category || "").replace(/&amp;/g, "&").trim();
      if (!categoryVal) {
        return { ok: false, message: "Category must be selected before specialization." };
      }
      const rawSpec = String(raw).replace(/&amp;/g, "&").trim();
      let cat = await prisma.category.findFirst({
        where: {
          OR: [
            { id: categoryVal },
            { name: { equals: categoryVal, mode: "insensitive" } },
            { id: String(input.category || cleaned.category) },
            { name: { equals: String(input.category || cleaned.category).trim(), mode: "insensitive" } },
          ],
        },
        include: { specializations: true },
      });
      if (cat && cat.specializations && cat.specializations.length > 0) {
        const specMatch = cat.specializations.find(
          (s) =>
            s.id === rawSpec ||
            s.name.toLowerCase() === rawSpec.toLowerCase() ||
            s.id === String(raw) ||
            s.name.toLowerCase() === String(raw).trim().toLowerCase()
        );
        if (specMatch) {
          cleaned[field.id] = specMatch.name;
        } else {
          cleaned[field.id] = rawSpec;
        }
      } else {
        cleaned[field.id] = rawSpec;
      }
    } else if (field.type === "number") {
      const num = Number(raw);
      if (Number.isNaN(num))
        return { ok: false, message: `${field.id} must be a number.` };
      if (field.min !== undefined && num < field.min)
        return { ok: false, message: `${field.id} is too low.` };
      if (field.max !== undefined && num > field.max)
        return { ok: false, message: `${field.id} is too high.` };
      cleaned[field.id] = num;
    } else if (field.type === "select") {
      if (!field.options.includes(raw))
        return { ok: false, message: `${field.id} has an invalid value.` };
      cleaned[field.id] = raw;
    } else {
      // text / textarea
      if (typeof raw !== "string")
        return { ok: false, message: `${field.id} must be text.` };
      const trimmed = sanitizeData(raw.trim());
      if (field.max && trimmed.length > field.max)
        return { ok: false, message: `${field.id} is too long.` };
      cleaned[field.id] = trimmed;
    }
  }

  return { ok: true, cleaned };
}

async function issueOtp(userId, otpType) {
  await prisma.otp.deleteMany({ where: { userId, otpType } });
  const code = await helper.generateOTP();
  await prisma.otp.create({
    data: {
      userId,
      otpType,
      otp: code,
      attempts: 0,
      expireTime: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });
  return code;
}

/**
 * Verifies otp against the stored record for (userId, otpType).
 * - Vanishes (deletes) the OTP row the moment it's found expired.
 * - Vanishes it after OTP_MAX_ATTEMPTS wrong guesses (forces a resend).
 * - Vanishes it on success too, since a used OTP must never work twice.
 * Returns { ok: true } or { ok: false, reason } — never throws for
 * "wrong code", only for genuine server errors.
 */
async function verifyStoredOtp(userId, otpType, submittedOtp) {
  const record = await prisma.otp.findFirst({ where: { userId, otpType } });
  if (!record) return { ok: false, reason: "missing" };

  if (new Date(record.expireTime) < new Date()) {
    await prisma.otp.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otp.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, reason: "locked" };
  }

  if (record.otp !== Number(submittedOtp)) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "mismatch" };
  }

  await prisma.otp.delete({ where: { id: record.id } }).catch(() => {});
  return { ok: true, record };
}

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify
 * endpoint. Returns true/false only — never throws, so a Cloudflare
 * outage fails closed (captcha treated as failed) rather than crashing
 * the calling request handler.
 */
async function verifyTurnstile(token, ip) {
  if (typeof token !== "string" || token.trim().length === 0) return false;

  try {
    const verifyRes = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    return verifyRes.data?.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error?.message);
    return false;
  }
}

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
  Object.entries(ACCOUNT_TYPES).map(([name, code]) => [code, name]),
);

class authController {
  // ── REGISTER · STEP 1: start (identity + profile in one call, since
  // that's what the current UI collects together) ────────────────────
  // static async registerStart(req, res) {
  //   try {
  //     let { name, username, phone, countryCode, email, password, role, captchaToken } = req.body;

  //     // SANITIZED: name is free text (user-typed display name) —
  //     // strip HTML before validation/storage. password/captchaToken/
  //     // username/phone/email are intentionally left untouched (they
  //     // are validated by strict regex/format checks below, and
  //     // sanitizing password would corrupt the hash).
  //     name = sanitizeData(name);

  //     console.log(name, "nameqwer4")

  //     // SECURITY: captcha gate — bot signup protection.
  //     const captchaOk = await verifyTurnstile(captchaToken, req.ip);
  //     if (!captchaOk) return helper.failed(res, CAPTCHA_FAIL_MESSAGE);

  //     if (!isValidEmail(email)) return helper.failed(res, "Please enter a valid email address.");
  //     if (!isValidPhone(phone)) return helper.failed(res, "Please enter a valid 10-digit mobile number.");
  //     if (!isValidName(name)) return helper.failed(res, "Please enter a valid name (2-50 characters).");
  //     if (!isValidUsername(username)) {
  //       return helper.failed(res, "Username must be 3-30 characters, using only letters, numbers, underscores and dots.");
  //     }
  //     if (!isValidPassword(password)) {
  //       return helper.failed(res, "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.");
  //     }

  //     // SECURITY: role is never trusted as-is. It must be an exact key
  //     // in ACCOUNT_TYPES — anything else (typos, numbers, "admin") is
  //     // rejected outright.
  //     const normalizedRole = ACCOUNT_TYPES[role];
  //     if (!normalizedRole) {
  //       return helper.failed(res, "Invalid account type.");
  //     }

  //     email = email.toLowerCase();

  //     const existing = await prisma.user.findFirst({ where: { email, isDeleted: false } });

  //     // SECURITY: generic response regardless of whether the email is
  //     // already registered — no "email already exists" leak.
  //     if (existing && existing.isVerified) {
  //       return helper.success(res, GENERIC_REGISTER_MESSAGE, { email });
  //     }

  //     const existingUsername = await prisma.user.findFirst({
  //       where: { username, isDeleted: false, NOT: existing ? { id: existing.id } : undefined },
  //     });
  //     if (existingUsername) {
  //       return helper.failed(res, "Username already taken");
  //     }

  //     const hashedPassword = await bcrypt.hash(password, 10);

  //     let user;
  //     if (!existing) {
  //       user = await prisma.user.create({
  //         data: {
  //           name, username, phone, email, countryCode,
  //           password: hashedPassword, role: normalizedRole,
  //           isVerified: false, isRegistered: false,
  //         },
  //       });
  //     } else {
  //       user = await prisma.user.update({
  //         where: { id: existing.id },
  //         data: { name, countryCode, username, phone, role: normalizedRole, password: hashedPassword },
  //       });
  //     }

  //     const otp = await issueOtp(user.id, "register");
  //     await emailService.sendOtpMail(email, name, otp, "register").catch(() => { });
  //     // (pass the actual code through if your emailService signature needs it —
  //     // kept out of the response either way)

  //     const session = await sessionStore.create({
  //       type: "register",
  //       email,
  //       userId: user.id,
  //       ip: req.ip,
  //       userAgent: req.headers["user-agent"],
  //     });

  //     return helper.success(res, GENERIC_REGISTER_MESSAGE, {
  //       registerSessionToken: session.token,
  //     });

  //   } catch (error) {
  //     console.error(error);
  //     if (error.code === "P2002") return helper.failed(res, "This value is already in use.");
  //     return helper.failed(res, GENERIC_SERVER_ERROR);
  //   }
  // }

  static async registerStart(req, res) {
    try {
      let {
        name,
        username,
        phone,
        countryCode,
        email,
        password,
        role,
        captchaToken,
      } = req.body;

      console.log("========== REGISTER START ==========");
      console.log("Registration request received");
      console.log("Email:", email);
      console.log("Username:", username);
      console.log("Role:", role);
      console.log("Country Code:", countryCode);

      name = sanitizeData(name);

      console.log("Sanitized name:", name);

      // SECURITY: captcha gate
      const captchaOk = await verifyTurnstile(captchaToken, req.ip);

      console.log("Captcha verification:", captchaOk);

      if (!captchaOk) {
        console.log("Registration failed: CAPTCHA verification failed");
        return helper.failed(res, CAPTCHA_FAIL_MESSAGE);
      }

      if (!isValidEmail(email)) {
        console.log("Registration failed: Invalid email");
        return helper.failed(res, "Please enter a valid email address.");
      }

      if (!isValidPhone(phone)) {
        console.log("Registration failed: Invalid phone");
        return helper.failed(
          res,
          "Please enter a valid 10-digit mobile number.",
        );
      }

      if (!isValidName(name)) {
        console.log("Registration failed: Invalid name");
        return helper.failed(
          res,
          "Please enter a valid name (2-50 characters).",
        );
      }

      if (!isValidUsername(username)) {
        console.log("Registration failed: Invalid username");
        return helper.failed(
          res,
          "Username must be 3-30 characters, using only letters, numbers, underscores and dots.",
        );
      }

      if (!isValidPassword(password)) {
        console.log("Registration failed: Invalid password format");
        return helper.failed(
          res,
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
        );
      }

      const normalizedRole = ACCOUNT_TYPES[role];

      console.log("Normalized role:", normalizedRole);

      if (!normalizedRole) {
        console.log("Registration failed: Invalid account type");
        return helper.failed(res, "Invalid account type.");
      }

      email = email.toLowerCase();

      console.log("Checking existing user for email:", email);

      const existing = await prisma.user.findFirst({
        where: {
          email,
          // isDeleted: false
        },
      });

      if (existing) {
        console.log("Existing active user found");
        console.log("Existing User ID:", existing.id);
        console.log("Existing user verified:", existing.isVerified);
        console.log("Existing user deleted:", existing.isDeleted);
      } else {
        console.log("No active user found for this email.");
        console.log(
          "If a deleted user exists, it will not be returned because isDeleted = false.",
        );
      }

      // Existing verified account
      if (existing && existing.isVerified) {
        console.log("Email already belongs to a verified account.");
        console.log("Returning generic registration response.");

        return helper.success(res, GENERIC_REGISTER_MESSAGE, { email });
      }

      console.log("Checking username availability:", username);

      const existingUsername = await prisma.user.findFirst({
        where: {
          username,
          isDeleted: false,
          NOT: existing ? { id: existing.id } : undefined,
        },
      });

      if (existingUsername) {
        console.log("Registration failed: Username already taken");
        console.log("Existing username user ID:", existingUsername.id);

        return helper.failed(res, "Username already taken");
      }

      console.log("Hashing password...");

      const hashedPassword = await bcrypt.hash(password, 10);

      let user;

      if (!existing) {
        console.log("Creating new user...");

        user = await prisma.user.create({
          data: {
            name,
            username,
            phone,
            email,
            countryCode,
            password: hashedPassword,
            role: normalizedRole,
            isVerified: false,
            isRegistered: false,
          },
        });

        console.log("New user created successfully.");
        console.log("New User ID:", user.id);
      } else {
        console.log("Existing unverified user found.");
        console.log("Updating existing user:", existing.id);

        user = await prisma.user.update({
          where: {
            id: existing.id,
          },
          data: {
            name,
            countryCode,
            username,
            phone,
            role: normalizedRole,
            password: hashedPassword,
          },
        });

        console.log("Existing user updated successfully.");
        console.log("Updated User ID:", user.id);
      }

      console.log("Issuing registration OTP...");

      const otp = await issueOtp(user.id, "register");

      console.log("OTP generated successfully.");

      await emailService
        .sendOtpMail(email, name, otp, "register")
        .catch((error) => {
          console.error("Failed to send registration OTP email:", error);
        });

      console.log("Creating registration session...");

      const session = await sessionStore.create({
        type: "register",
        email,
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      console.log("Registration session created successfully.");
      console.log("Registration completed successfully.");
      console.log("========== REGISTER END ==========");

      return helper.success(res, GENERIC_REGISTER_MESSAGE, {
        registerSessionToken: session.token,
      });
    } catch (error) {
      console.error("========== REGISTER ERROR ==========");
      console.error(error);

      if (error.code === "P2002") {
        console.log("Registration failed: Unique constraint violation");
        return helper.failed(res, "This value is already in use.");
      }

      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── REGISTER · STEP 2: verify OTP ("isVerify") — confirms email
  // ownership only. Does NOT create the wallet or issue a JWT yet. ────
  static async registerVerifyOtp(req, res) {
    try {
      const { registerSessionToken, otp } = req.body;

      if (otp === undefined || otp === null || Number.isNaN(Number(otp))) {
        return helper.failed(res, GENERIC_OTP_FAIL);
      }

      const session = await sessionStore.get(registerSessionToken, "register");
      if (!session || !session.userId)
        return helper.failed(res, GENERIC_SESSION_FAIL);

      console.log(session, "session12334");

      const result = await verifyStoredOtp(session.userId, "register", otp);
      if (!result.ok) {
        if (result.reason === "locked") {
          await sessionStore.destroy(session.id);
          return helper.failed(
            res,
            "Too many incorrect attempts. Please request a new code.",
          );
        }
        return helper.failed(res, GENERIC_OTP_FAIL);
      }

      await prisma.user.update({
        where: { id: session.userId },
        data: { isVerified: true },
      });
      await sessionStore.advance(session.id, { step: "verified" });

      return helper.success(res, "Email verified.", { registerSessionToken });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── REGISTER · STEP 3: create account — persists location + role
  // profile fields once email ownership is confirmed. ────────────────
  static async registerCreateAccount(req, res) {
    try {
      let { registerSessionToken, country, state, city, address, roleFields } =
        req.body;

      // SANITIZED: location fields are free text — strip HTML before
      // validation/storage. registerSessionToken is an opaque token
      // and intentionally left untouched.
      country = sanitizeData(country);
      state = sanitizeData(state);
      city = sanitizeData(city);
      address = sanitizeData(address);

      if (!isValidText(country, { max: 100 }))
        return helper.failed(res, "Please enter a valid country.");
      if (!isValidText(state, { max: 100 }))
        return helper.failed(res, "Please enter a valid state.");
      if (!isValidText(city, { max: 100 }))
        return helper.failed(res, "Please enter a valid city.");
      if (!isValidText(address, { max: 500 }))
        return helper.failed(res, "Please enter a valid address.");

      const session = await sessionStore.get(registerSessionToken, "register");
      if (!session || !session.userId)
        return helper.failed(res, GENERIC_SESSION_FAIL);
      if (session.step !== "verified" && session.step !== "profile_complete") {
        return helper.failed(res, GENERIC_SESSION_FAIL);
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      if (!user) return helper.failed(res, GENERIC_SESSION_FAIL);

      // SECURITY: validate roleFields server-side against the schema for
      // this user's actual stored role only when non-empty profile fields are supplied.
      // During the Location step, roleFields are not yet supplied, so category/specialization
      // validation is not triggered until the Profile step.
      const hasRoleFields =
        roleFields &&
        typeof roleFields === "object" &&
        Object.keys(roleFields).some(
          (k) =>
            roleFields[k] !== undefined &&
            roleFields[k] !== null &&
            String(roleFields[k]).trim() !== ""
        );

      let validation = { ok: true, cleaned: {} };
      if (hasRoleFields) {
        validation = await validateRoleFields(user.role, roleFields);
        if (!validation.ok) return helper.failed(res, validation.message);
      }

      await prisma.user.update({
        where: { id: session.userId },
        data: {
          ...(country && { country }),
          ...(state && { state }),
          ...(city && { city }),
          ...(address && { address }),
          ...(validation.cleaned.category && {
            category: validation.cleaned.category,
          }),
          ...(validation.cleaned.specialization && {
            specialization: validation.cleaned.specialization,
          }),
          ...(hasRoleFields && {
            profile: JSON.stringify(validation.cleaned),
          }),
        },
      });

      if (hasRoleFields) {
        if (user.role === ACCOUNT_TYPES.Designer) {
          await prisma.designer.upsert({
            where: { userId: session.userId },
            update: {
              category: validation.cleaned.category ?? undefined,
              specializations: validation.cleaned.specialization
                ? [validation.cleaned.specialization]
                : undefined,
              ...(validation.cleaned.bio && { bio: validation.cleaned.bio }),
              ...(validation.cleaned.experience !== undefined && {
                yearsOfExperience: Number(validation.cleaned.experience),
              }),
              ...(validation.cleaned.style && {
                designStyles: [validation.cleaned.style],
              }),
            },
            create: {
              userId: session.userId,
              category: validation.cleaned.category ?? null,
              specializations: validation.cleaned.specialization
                ? [validation.cleaned.specialization]
                : [],
              bio: validation.cleaned.bio ?? null,
              yearsOfExperience: validation.cleaned.experience !== undefined ? Number(validation.cleaned.experience) : null,
              designStyles: validation.cleaned.style ? [validation.cleaned.style] : [],
            },
          });
        } else if (user.role === ACCOUNT_TYPES.Architect) {
          const exp = validation.cleaned.experience !== undefined ? Number(validation.cleaned.experience) : 0;
          const expLevel = exp >= 8 ? "EXPERT" : exp >= 4 ? "ADVANCED" : exp >= 2 ? "INTERMEDIATE" : "BEGINNER";
          const specs = validation.cleaned.specialization ? JSON.stringify([validation.cleaned.specialization]) : "[]";
          const softs = validation.cleaned.software ? JSON.stringify([validation.cleaned.software]) : "[]";

          await prisma.architect.upsert({
            where: { userId: session.userId },
            update: {
              bio: validation.cleaned.bio || undefined,
              yearsOfExperience: exp,
              experienceLevel: expLevel,
              specializations: specs,
              certifications: softs,
            },
            create: {
              userId: session.userId,
              bio: validation.cleaned.bio || null,
              yearsOfExperience: exp,
              experienceLevel: expLevel,
              specializations: specs,
              licenseNumber: `PENDING-${session.userId}`,
              certifications: softs,
              portfolioLinks: "[]",
              serviceCities: JSON.stringify([city, state].filter(Boolean)),
              minBudgetHandled: 0,
              maxBudgetHandled: 0,
            },
          });
        } else if (user.role === ACCOUNT_TYPES.Contractor) {
          const exp = validation.cleaned.experience !== undefined ? Number(validation.cleaned.experience) : 0;
          const expLevel = exp >= 8 ? "EXPERT" : exp >= 4 ? "ADVANCED" : exp >= 2 ? "INTERMEDIATE" : "BEGINNER";
          const trades = validation.cleaned.trade ? JSON.stringify([validation.cleaned.trade]) : "[]";

          await prisma.contractor.upsert({
            where: { userId: session.userId },
            update: {
              bio: validation.cleaned.bio || undefined,
              yearsOfExperience: exp,
              experienceLevel: expLevel,
              workTypes: trades,
            },
            create: {
              userId: session.userId,
              bio: validation.cleaned.bio || null,
              yearsOfExperience: exp,
              experienceLevel: expLevel,
              workTypes: trades,
              licenseNumber: `PENDING-${session.userId}`,
              certifications: "[]",
              portfolioLinks: "[]",
              serviceCities: JSON.stringify([city, state].filter(Boolean)),
              minBudgetHandled: 0,
              maxBudgetHandled: 0,
            },
          });
        } else if (user.role === ACCOUNT_TYPES.MaterialSupplier) {
          const shop = validation.cleaned.businessName || user.name || "Building Material Supplier";
          await prisma.contactDetails.upsert({
            where: { supplierId: session.userId },
            update: {
              shopName: shop,
              address: address || "N/A",
              pincode: "000000",
              state: state || "N/A",
              city: city || "N/A",
              country: country || "India",
              whatsappNumber: user.phone || "",
              callNumber: user.phone || "",
              email: user.email || "",
            },
            create: {
              supplierId: session.userId,
              shopName: shop,
              address: address || "N/A",
              pincode: "000000",
              state: state || "N/A",
              city: city || "N/A",
              country: country || "India",
              whatsappNumber: user.phone || "",
              callNumber: user.phone || "",
              email: user.email || "",
            },
          });
        }
      }

      await sessionStore.advance(session.id, { step: "profile_complete" });

      return helper.success(res, "Account details saved.", {
        registerSessionToken,
      });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── REGISTER · STEP 4: finish — flips isRegistered, creates the
  // wallet, issues the JWT, and burns the session. ───────────────────
  static async registerFinish(req, res) {
    try {
      const { registerSessionToken } = req.body;

      const session = await sessionStore.get(registerSessionToken, "register");
      if (!session || !session.userId)
        return helper.failed(res, GENERIC_SESSION_FAIL);
      if (session.step !== "profile_complete")
        return helper.failed(res, GENERIC_SESSION_FAIL);

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      if (!user || !user.isVerified)
        return helper.failed(res, GENERIC_SESSION_FAIL);

      if (user.role === ACCOUNT_TYPES.Designer && (!user.category || !user.specialization)) {
        return helper.failed(res, "Category and Specialization are required to complete Designer registration.");
      }

      const loginTime = new Date();

      await prisma.user.update({
        where: { id: user.id },
        data: { isRegistered: true, loginTime },
      });

      const existingWallet = await prisma.wallet.findFirst({
        where: { userId: user.id },
      });
      if (!existingWallet) {
        await prisma.wallet.create({
          data: {
            userId: user.id,
            totalAvailableBalance: 0,
            createdBy: user.id,
            updatedBy: user.id,
          },
        });
      }

      // jwt expires in  15 minutes from the current time.
      const token = JWT.sign(
        {
          id: user.id,
          loginTime,
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        },
        process.env.JWT_SK,
      );

      await sessionStore.destroy(session.id);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      updatedUser.token = token;

      return helper.success(res, "Account created successfully.", {
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        role: ACCOUNT_TYPE_NAMES[updatedUser.role] || updatedUser.role,
        token: updatedUser.token,
      });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── RESEND OTP — otpType is a hardcoded literal per branch, never
  // derived from client input or passed through. ─────────────────────
  static async resendOtp(req, res) {
    try {
      const { registerSessionToken, forgotSessionToken } = req.body;

      if (registerSessionToken) {
        const session = await sessionStore.get(
          registerSessionToken,
          "register",
        );
        if (!session || !session.userId) {
          return helper.success(res, GENERIC_RESEND_MESSAGE, {});
        }

        const user = await prisma.user.findUnique({
          where: { id: session.userId },
        });
        if (!user) return helper.success(res, GENERIC_RESEND_MESSAGE, {});

        await issueOtp(user.id, "register");
        await emailService
          .sendOtpMail(user.email, user.name, undefined, "register")
          .catch(() => {});
        return helper.success(res, GENERIC_RESEND_MESSAGE, {});
      }

      if (forgotSessionToken) {
        const session = await sessionStore.get(forgotSessionToken, "forgot");
        if (!session || !session.userId) {
          return helper.success(res, GENERIC_RESEND_MESSAGE, {});
        }

        const user = await prisma.user.findUnique({
          where: { id: session.userId },
        });
        if (!user) return helper.success(res, GENERIC_RESEND_MESSAGE, {});

        await issueOtp(user.id, "forgotPassword");
        await emailService
          .sendOtpMail(user.email, user.name, undefined, "forgotPassword")
          .catch(() => {});
        return helper.success(res, GENERIC_RESEND_MESSAGE, {});
      }

      // Neither token provided — generic response, no leak.
      return helper.success(res, GENERIC_RESEND_MESSAGE, {});
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── FORGOT PASSWORD · STEP 1: start ─────────────────────────────────
  static async forgotStart(req, res) {
    try {
      let { email, captchaToken } = req.body;

      // SECURITY: captcha gate — prevents automated enumeration/spam
      // of the forgot-password flow.
      const captchaOk = await verifyTurnstile(captchaToken, req.ip);
      if (!captchaOk) return helper.failed(res, CAPTCHA_FAIL_MESSAGE);

      if (!isValidEmail(email))
        return helper.failed(res, "Please enter a valid email address.");
      email = email.toLowerCase();

      const user = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      // Always create a session and return the same shape, whether or
      // not the account exists — this is what actually prevents
      // enumeration (not the message text alone).
      const session = await sessionStore.create({
        type: "forgot",
        email,
        userId: user ? user.id : null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      if (user) {
        await issueOtp(user.id, "forgotPassword");
        const code = await prisma.otp.findFirst({
          where: { userId: user.id, otpType: "forgotPassword" },
        });
        await emailService
          .sendOtpMail(email, user.name, code?.otp, "forgotPassword")
          .catch(() => {});
      }

      return helper.success(res, GENERIC_FORGOT_MESSAGE, {
        forgotSessionToken: session.token,
      });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── FORGOT PASSWORD · STEP 2: verify OTP → returns a reset-scoped
  // session (separate step/token, so a stale forgot session can't be
  // reused to reset a password without the OTP check happening first).
  static async forgotVerifyOtp(req, res) {
    try {
      const { forgotSessionToken, otp } = req.body;

      const session = await sessionStore.get(forgotSessionToken, "forgot");
      if (!session) return helper.failed(res, GENERIC_OTP_FAIL);

      // No linked user (email didn't exist) — fail the same way a wrong
      // OTP would, so timing/response shape doesn't leak existence.
      if (!session.userId) {
        return helper.failed(res, GENERIC_OTP_FAIL);
      }

      const result = await verifyStoredOtp(
        session.userId,
        "forgotPassword",
        otp,
      );
      if (!result.ok) {
        if (result.reason === "locked") {
          await sessionStore.destroy(session.id);
          return helper.failed(
            res,
            "Too many incorrect attempts. Please request a new code.",
          );
        }
        return helper.failed(res, GENERIC_OTP_FAIL);
      }

      await sessionStore.advance(session.id, { step: "verified" });

      return helper.success(res, "OTP verified.", { forgotSessionToken });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── FORGOT PASSWORD · STEP 3: reset — uses the session, not a raw
  // email, so the request can't skip the OTP step by just supplying an
  // email address it doesn't own. ─────────────────────────────────────
  static async resetPassword(req, res) {
    try {
      const { forgotSessionToken, newPassword } = req.body;

      if (!isValidPassword(newPassword)) {
        return helper.failed(
          res,
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
        );
      }

      const session = await sessionStore.get(forgotSessionToken, "forgot");
      if (!session || !session.userId || session.step !== "verified") {
        return helper.failed(
          res,
          "Unable to reset password. Please restart the process.",
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: session.userId },
        data: {
          password: hashedPassword,
          forgotReq: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await sessionStore.destroy(session.id);

      return helper.success(res, "Password updated successfully.", {});
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── CHANGE PASSWORD REQUEST (logged-in user) ────────────────────────
  static async changePasswordReq(req, res) {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return helper.failed(res, "Unable to process request.");

      await issueOtp(user.id, "changePassword");
      const record = await prisma.otp.findFirst({
        where: { userId: user.id, otpType: "changePassword" },
      });
      await emailService
        .sendOtpMail(user.email, user.name, record?.otp, "changePassword")
        .catch(() => {});

      return helper.success(res, "OTP sent to email", { email: user.email });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── LOGIN ────────────────────────────────────────────────────────────
  static async login(req, res) {
    try {
      let { email, password, captchaToken } = req.body;

      // SECURITY: captcha gate — throttles automated credential
      // stuffing / brute-force attempts on top of the lockout logic
      // below and the IP-level rateLimiter middleware.
      const captchaOk = await verifyTurnstile(captchaToken, req.ip);
      if (!captchaOk) {
        return res
          .status(401)
          .json({ success: false, message: CAPTCHA_FAIL_MESSAGE });
      }

      if (email && !isValidEmail(email))
        return res
          .status(401)
          .json({ success: false, message: INVALID_LOGIN_MESSAGE });
      if (typeof password !== "string" || password.length === 0) {
        return res
          .status(401)
          .json({ success: false, message: INVALID_LOGIN_MESSAGE });
      }

      // NOTE: password is intentionally never sanitized — it must be
      // compared byte-for-byte against the hash. Sanitizing it would
      // corrupt legitimate passwords containing spaces/special chars.
      if (email) email = email.toLowerCase();

      const findUser = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      const rejectLogin = (message = INVALID_LOGIN_MESSAGE) =>
        res.status(401).json({ success: false, message });

      if (!findUser) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return rejectLogin();
      }

      if (findUser.lockedUntil && new Date(findUser.lockedUntil) > new Date()) {
        return rejectLogin(LOCKED_MESSAGE);
      }

      if (!findUser.isVerified) {
        // Unverified accounts simply can't log in yet — they are NOT
        // deleted or touched. The person needs to finish the OTP step
        // via the register flow (or request a fresh code there).
        await bcrypt.compare(password, findUser.password);
        return rejectLogin("Please verify your email before logging in.");
      }

      if (findUser.isBlocked) {
        await bcrypt.compare(password, findUser.password);
        return rejectLogin();
      }

      const matched = await bcrypt.compare(password, findUser.password);

      if (!matched) {
        const attempts = (findUser.failedLoginAttempts || 0) + 1;
        const data = { failedLoginAttempts: attempts };
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
          data.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        }
        await prisma.user.update({ where: { id: findUser.id }, data });
        return rejectLogin(
          attempts >= LOGIN_MAX_ATTEMPTS ? LOCKED_MESSAGE : undefined,
        );
      }

      const loginTime = new Date();
      await prisma.user.update({
        where: { id: findUser.id },
        data: { loginTime, failedLoginAttempts: 0, lockedUntil: null },
      });

      const updatedUser = await prisma.user.findUnique({
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
          wallets: {
            select: {
              totalAvailableBalance: true,
            },
          },
        },
      });

      updatedUser.role =
        ACCOUNT_TYPE_NAMES[updatedUser.role] || updatedUser.role;

      const token = JWT.sign(
        {
          id: findUser.id,
          loginTime,
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        },
        process.env.JWT_SK,
      );

      updatedUser.token = token;
      return helper.success(res, "User Login Successful", updatedUser);
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  static async adminLogin(req, res) {
    try {
      let { email, password } = req.body;

      if (email && !isValidEmail(email))
        return res
          .status(401)
          .json({ success: false, message: INVALID_LOGIN_MESSAGE });
      if (typeof password !== "string" || password.length === 0) {
        return res
          .status(401)
          .json({ success: false, message: INVALID_LOGIN_MESSAGE });
      }

      if (email) email = email.toLowerCase();

      const findUser = await prisma.user.findFirst({
        where: {
          email,
          isDeleted: false,
          role: { in: [ACCOUNT_TYPES.Admin, ACCOUNT_TYPES.subAdmin] },
        },
      });

      const rejectLogin = (message = INVALID_LOGIN_MESSAGE) =>
        res.status(401).json({ success: false, message });

      if (!findUser) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return rejectLogin();
      }

      if (findUser.lockedUntil && new Date(findUser.lockedUntil) > new Date()) {
        return rejectLogin(LOCKED_MESSAGE);
      }

      if (!findUser.isVerified) {
        await bcrypt.compare(password, findUser.password);
        return rejectLogin("Please verify your email before logging in.");
      }

      if (findUser.isBlocked) {
        await bcrypt.compare(password, findUser.password);
        return rejectLogin();
      }

      const matched = await bcrypt.compare(password, findUser.password);

      if (!matched) {
        const attempts = (findUser.failedLoginAttempts || 0) + 1;
        const data = { failedLoginAttempts: attempts };
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
          data.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        }
        await prisma.user.update({ where: { id: findUser.id }, data });
        return rejectLogin(
          attempts >= LOGIN_MAX_ATTEMPTS ? LOCKED_MESSAGE : undefined,
        );
      }

      const loginTime = new Date();
      await prisma.user.update({
        where: { id: findUser.id },
        data: { loginTime, failedLoginAttempts: 0, lockedUntil: null },
      });

      const updatedUser = await prisma.user.findUnique({
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
          wallets: {
            select: {
              totalAvailableBalance: true,
            },
          },
          permissions: true,
        },
      });

      // Super admin (role 0) always gets the full permission set,
      // regardless of what's stored in the DB for them.
      if (updatedUser.role === ACCOUNT_TYPES.Admin) {
        updatedUser.permissions = [...allPermissions];
      }

      updatedUser.role =
        ACCOUNT_TYPE_NAMES[updatedUser.role] || updatedUser.role;

      const token = JWT.sign(
        {
          id: findUser.id,
          loginTime,
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        },
        process.env.JWT_SK,
      );

      updatedUser.token = token;
      return helper.success(res, "User Login Successful", updatedUser);
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── REFRESH TOKEN ────────────────────────────────────────────────────
  static async refreshToken(req, res) {
    try {
      const authHeader = req.headers["authorization"];
      const expiredToken = authHeader && authHeader.split(" ")[1];
      if (!expiredToken)
        return res.status(401).json({ message: "Refresh Token is required" });

      const decoded = JWT.decode(expiredToken);
      if (!decoded)
        return res.status(403).json({ message: "Invalid Refresh Token" });

      JWT.verify(expiredToken, process.env.JWT_SK, (err) => {
        if (err && err.name !== "TokenExpiredError") {
          return res.status(403).json({ message: "Invalid Refresh Token" });
        }
        const token = JWT.sign(
          { id: decoded.id, exp: Math.floor(Date.now() / 1000) + 60 * 15 },
          process.env.JWT_SK,
        );
        return helper.success(res, "Refresh Token Generated Successfully", {
          token,
        });
      });
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── CHANGE PASSWORD (logged-in user) ─────────────────────────────────
  static async changePassword(req, res) {
    try {
      const { newPassword } = req.body;
      const requesterEmail = req.user ? req.user.email : req.admin.email;

      // NOTE: newPassword intentionally never sanitized — same reason
      // as login: it must be hashed exactly as typed.
      if (!isValidPassword(newPassword)) {
        return helper.failed(
          res,
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
        );
      }

      const findEmail = await prisma.user.findFirst({
        where: { email: requesterEmail, isDeleted: false },
      });
      if (!findEmail) return helper.failed(res, "Unable to process request.");

      const isSamePassword = bcrypt.compareSync(
        newPassword,
        findEmail.password,
      );
      if (isSamePassword)
        return helper.failed(
          res,
          "New password cannot be the same as the old password",
        );

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: findEmail.id },
        data: { password: hashedPassword },
      });

      return helper.success(res, "Password Updated Successfully");
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── CAPTCHA VERIFY (Cloudflare Turnstile) ──────────────────────────
  // Standalone check-only endpoint — kept for any place in the UI that
  // wants to verify a token before a full form submit. NOT the primary
  // security gate; the real gate is inside registerStart / login /
  // forgotStart above, which call verifyTurnstile() directly so the
  // check can't be skipped by not calling this route.
  static async verifyCaptcha(req, res) {
    try {
      const { token } = req.body;
      const ok = await verifyTurnstile(token, req.ip);
      if (!ok) return helper.failed(res, CAPTCHA_FAIL_MESSAGE);
      return helper.success(res, "Captcha verified.", {});
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────
  static async logout(req, res) {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { loginTime: null },
      });
      return helper.success(res, "Logout Successfully", {});
    } catch (error) {
      console.error(error);
      return helper.failed(res, GENERIC_SERVER_ERROR);
    }
  }

  // ── CHECK USERNAME ───────────────────────────────────────────────────
  static async checkUsername(req, res) {
    try {
      const { username } = req.query;

      if (!username || username.trim().length < 3) {
        return res.status(400).json({
          available: false,
          message: "Username must be at least 3 characters",
        });
      }
      const normalized = username.trim().toLowerCase();
      if (!isValidUsername(normalized)) {
        return res.status(200).json({
          available: false,
          message:
            "Username can only contain letters, numbers, underscores and dots",
        });
      }
      const existingUser = await prisma.user.findUnique({
        where: { username: normalized },
        select: { id: true },
      });
      return res.status(200).json({
        available: !existingUser,
        message: existingUser
          ? "Username is already taken"
          : "Username is available",
      });
    } catch (err) {
      console.error("checkUsername error:", err);
      return res
        .status(500)
        .json({ available: false, message: "Could not check username" });
    }
  }
}

export default authController;
