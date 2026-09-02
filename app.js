import cors from "cors";
import dotenv from "dotenv";
import Express from "express";
import db from "./config/db.js";
import allRoutes from "./router/allRoutes.js";
import logger from "./helper/logger.js"
import helmet from "helmet";
import http from "http";
import { connectToDatabase } from "./config/config.js";
import { connectToPostgres } from "./config/postgres.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { initSocketServer } from "./socket/socketServer.js";
dotenv.config();

const app = Express();
const PORT = db.PORT || 3000;

app.use(helmet());
app.use(cors());
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

connectToPostgres();

const server = http.createServer(app);
initSocketServer(server);

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`App started on port ${PORT}`);
});