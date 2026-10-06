import logger from "../helper/logger.js";

export const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "https://nodindia.com",
  "https://www.nodindia.com",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL.trim()] : []),
];

/**
 * Checks if an origin is allowed by whitelist, pattern, or environment
 */
export function isOriginAllowed(origin) {
  // Allow requests without Origin (curl, mobile apps, server-to-server, Postman)
  if (!origin) return true;

  // Exact match
  if (allowedOrigins.includes(origin)) return true;

  // Firebase Hosting
  if (/^https:\/\/[a-zA-Z0-9-]+\.web\.app$/.test(origin) || /^https:\/\/[a-zA-Z0-9-]+\.firebaseapp\.com$/.test(origin)) {
    return true;
  }

  // Google Cloud Run
  if (/^https:\/\/[a-zA-Z0-9-]+\.a\.run\.app$/.test(origin)) {
    return true;
  }

  // Render
  if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
    return true;
  }

  // Vercel preview
  if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Dev fallback
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

/**
 * Express CORS options
 */
export const expressCorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    logger.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-requested-with",
    "idempotency-key",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
  ],
};

/**
 * Socket.IO CORS options
 */
export const socketCorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    logger.warn(`[Socket:CORS] Blocked socket connection from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"), false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type", "x-requested-with"],
};
