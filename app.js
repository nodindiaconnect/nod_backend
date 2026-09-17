import cors from "cors";
import dotenv from "dotenv";
import Express from "express";
import db from "./config/db.js";
import allRoutes from "./router/allRoutes.js";
import logger from "./helper/logger.js"
import helmet from "helmet";
import http from "http";
import { connectToPostgres } from "./config/postgres.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { initSocketServer } from "./socket/socketServer.js";
dotenv.config();

const app = Express();
const PORT = db.PORT || 3000;

// const allowedOrigins = [
//     "http://localhost:5173",
//     "http://localhost:5174",
//     "http://localhost:3000",
//     "http://127.0.0.1:5173",
//     "http://127.0.0.1:5174",
//     "https://nodindia.com",
//     "https://www.nodindia.com",
//     ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : []),
//     ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
//     ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL.trim()] : []),
// ].filter(Boolean);

// const corsOptions = {
//     origin: (origin, callback) => {
//         // Allow requests with no origin (mobile apps, curl, server-to-server, Postman)
//         if (!origin) return callback(null, true);

//         // Allow defined whitelist
//         if (allowedOrigins.includes(origin)) return callback(null, true);

//         // Allow *.onrender.com and Firebase hosting domains (*.web.app, *.firebaseapp.com)
//         if (
//             /^https:\/\/.*\.onrender\.com$/.test(origin) ||
//             /^https:\/\/.*\.web\.app$/.test(origin) ||
//             /^https:\/\/.*\.firebaseapp\.com$/.test(origin)
//         ) {
//             return callback(null, true);
//         }

//         // Allow all in development
//         if (process.env.NODE_ENV !== "production") {
//             return callback(null, true);
//         }

//         logger.warn(`Blocked CORS request from origin: ${origin}`);
//         return callback(new Error("Not allowed by CORS"));
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "x-requested-with", "idempotency-key"],
// };



const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",

  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",

  "https://nodindia.com",
  "https://www.nodindia.com",

  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : []),

  ...(process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL.trim()]
    : []),

  ...(process.env.ADMIN_URL
    ? [process.env.ADMIN_URL.trim()]
    : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    if (!origin) {
      return callback(null, true);
    }

    // Exact allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Firebase Hosting
    if (
      /^https:\/\/.+\.web\.app$/.test(origin) ||
      /^https:\/\/.+\.firebaseapp\.com$/.test(origin)
    ) {
      return callback(null, true);
    }

    // Render frontend/backend domains
    if (/^https:\/\/.+\.onrender\.com$/.test(origin)) {
      return callback(null, true);
    }

    // Allow all origins during development
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    logger.warn(`Blocked CORS request from origin: ${origin}`);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

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



app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions));
app.disable("x-powered-by");

app.use(Express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(Express.urlencoded({ limit: "50mb", extended: true }));


// Health check
app.get("/", (req, res) => {
  res.json({ status: "working" });
});

app.use(sanitizeRequest);


// API routes
app.use("/api", allRoutes);

// Fallback for direct function calls where /api prefix is stripped
app.use("/", (req, res, next) => {
  if (req.path === "/" || req.path === "") {
    return res.json({ status: "working" });
  }
  return allRoutes(req, res, next);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.url });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err?.message);
  const errorMessage =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err?.message || "Unknown error";
  res.status(500).json({ error: errorMessage });
});

// Detect whether running in serverless environment (Firebase Cloud Functions / Cloud Run)
const isServerless = Boolean(
  process.env.FUNCTION_TARGET ||
  process.env.K_SERVICE ||
  process.env.FIREBASE_CONFIG ||
  process.env.FUNCTIONS_EMULATOR
);

// Check if app.js was invoked directly (e.g. `node app.js`, `nodemon app.js`)
const isDirectRun = Boolean(
  process.argv[1] &&
  /[\\/]app(\.js)?$/i.test(process.argv[1])
);

// Only start standalone HTTP & WebSocket server when running locally / directly
if (!isServerless && isDirectRun) {
  connectToPostgres();

  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`App started on port ${PORT}`);
  });
}

export default app;
