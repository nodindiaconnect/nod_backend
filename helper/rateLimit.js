import redisClient from "./teamCache.js";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

const WINDOW_SIZE_LOGIN = 3 * 60;
const WINDOW_SIZE_DEFAULT = 5 * 60;
const MAX_WINDOW_REQUEST_COUNT = 5;

export const rateLimiter = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const email =
      req.body?.email ||
      req.query?.email ||
      req.headers?.email ||
      req.user?.email;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // Determine window size based on route
    const route = req.baseUrl + req.path;
    const isLoginRoute = route.includes("/login");
    const isResresendOtp = route.includes("/resendOtp");
    const WINDOW_SIZE_IN_SECONDS =
      isLoginRoute || isResresendOtp ? WINDOW_SIZE_LOGIN : WINDOW_SIZE_DEFAULT;
    const retryAfterMessage = isLoginRoute ? "3 minutes" : "5 minutes";

    // Route-aware key
    const key = `rate_limit:${route}:${ip}_${email}`;


    const currentTime = moment().unix();
    const windowStartTimestamp = currentTime - WINDOW_SIZE_IN_SECONDS;

    // Remove outdated entries
    await redisClient.zremrangebyscore(key, 0, windowStartTimestamp);

    // Count requests in time window
    const requestCount = await redisClient.zcount(
      key,
      windowStartTimestamp,
      currentTime,
    );

    if (requestCount >= MAX_WINDOW_REQUEST_COUNT) {
      return res.status(429).json({
        success: 0,
        status_code: 429,
        message: `Too many requests. Rate limit exceeded. Please try again after ${retryAfterMessage}.`,
        data: { email },
      });
    }

    // Add current timestamp to Redis sorted set
    await redisClient.zadd(key, currentTime, `${currentTime}-${Math.random()}`);
    await redisClient.expire(key, WINDOW_SIZE_IN_SECONDS);

    return next();
  } catch (err) {
    console.error("Rate limiter failed:", err);
    return res.status(500).json({ error: "Internal rate limiter error" });
  }
};

export const canSendMessage = async (userId, chatId, limit, windowSeconds) => {
  // if (!userId || !chatId) {
  //   throw new Error("userId and chatId are required");
  // }

  const key = `chat_rate_limit:${chatId}:${userId}`;
  const currentTime = moment().unix();
  const windowStart = currentTime - windowSeconds;

  // Remove old messages outside the window
  await redisClient.zremrangebyscore(key, 0, windowStart);

  // Count messages in current window
  const messageCount = await redisClient.zcount(key, windowStart, currentTime);

  if (messageCount >= limit) {
    return false; // rate limit exceeded
  }

  // Add current message timestamp
  await redisClient.zadd(key, currentTime, `${currentTime}-${Math.random()}`);
  await redisClient.expire(key, windowSeconds);

  return true;
};
