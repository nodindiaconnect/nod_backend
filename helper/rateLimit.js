import prisma from "../config/prismaClient.js";

const WINDOW_SIZE_LOGIN = 3 * 60 * 1000;     // 3 minutes
const WINDOW_SIZE_DEFAULT = 5 * 60 * 1000;   // 5 minutes
const MAX_WINDOW_REQUEST_COUNT = 5;

export const rateLimiter = async (req, res, next) => {
  try {
    const email =
      req.body?.email ||
      req.query?.email ||
      req.headers?.email ||
      req.user?.email;

    if (!email) {
      return res.status(400).json({
        success: 0,
        message: "Email is required.",
      });
    }

    const route = req.baseUrl + req.path;

    const isLoginRoute = route.includes("/login");
    const isResendOtp = route.includes("/resendOtp");

    const WINDOW_SIZE = isLoginRoute
      ? WINDOW_SIZE_LOGIN
      : WINDOW_SIZE_DEFAULT;

    const identifier = `${req.ip}:${email}`;

    const now = new Date();

    let record = await prisma.rateLimit.findUnique({
      where: {
        identifier_action: {
          identifier,
          action: route,
        },
      },
    });

    if (!record) {
      await prisma.rateLimit.create({
        data: {
          identifier,
          action: route,
          count: 1,
          windowStart: now,
        },
      });

      return next();
    }

    // Check if blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      return res.status(429).json({
        success: 0,
        message: "Too many requests. Please try again later.",
      });
    }

    const windowExpired =
      now.getTime() - record.windowStart.getTime() > WINDOW_SIZE;

    if (windowExpired) {
      await prisma.rateLimit.update({
        where: { id: record.id },
        data: {
          count: 1,
          windowStart: now,
          blockedUntil: null,
        },
      });

      return next();
    }

    if (record.count >= MAX_WINDOW_REQUEST_COUNT) {
      await prisma.rateLimit.update({
        where: { id: record.id },
        data: {
          blockedUntil: new Date(now.getTime() + WINDOW_SIZE),
        },
      });

      return res.status(429).json({
        success: 0,
        message: `Too many requests. Please try again after ${isLoginRoute ? "3 minutes" : "5 minutes"
          }.`,
      });
    }

    await prisma.rateLimit.update({
      where: { id: record.id },
      data: {
        count: {
          increment: 1,
        },
      },
    });

    next();
  } catch (error) {
    next(error);
  }
};