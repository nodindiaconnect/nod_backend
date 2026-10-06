import cors from "cors";
import dotenv from "dotenv";
import Express from "express";
import db from "./config/db.js";
import allRoutes from "./router/allRoutes.js";
import logger from "./helper/logger.js";
import helmet from "helmet";
import http from "http";
import { connectToPostgres } from "./config/postgres.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { initSocketServer, getIO } from "./socket/socketServer.js";
import { expressCorsOptions } from "./config/corsConfig.js";

dotenv.config();

const app = Express();
const PORT = process.env.PORT || db.PORT || 3000;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(expressCorsOptions));
app.disable("x-powered-by");

app.use(
  Express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(Express.urlencoded({ limit: "50mb", extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "working" });
});

// Socket.IO polling request handler (when accessed via HTTP/functions)
app.use("/socket.io", (req, res, next) => {
  const io = getIO();
  if (io && io.engine) {
    io.engine.handleRequest(req, res);
  } else {
    next();
  }
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

// Detect whether running directly via `node app.js`
const isDirectRun = Boolean(
  process.argv[1] && /[\\/]app(\.js)?$/i.test(process.argv[1])
);

if (isDirectRun) {
  connectToPostgres().then(() => {
    const server = http.createServer(app);
    initSocketServer(server);
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`App started on port ${PORT}`);
    });
  });
}

export default app;
