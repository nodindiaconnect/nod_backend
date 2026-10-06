import http from "http";
import dotenv from "dotenv";
import app from "./app.js";
import db from "./config/db.js";
import logger from "./helper/logger.js";
import { connectToPostgres } from "./config/postgres.js";
import { initSocketServer } from "./socket/socketServer.js";

dotenv.config();

const PORT = process.env.PORT || db.PORT || 3000;

async function startServer() {
  try {
    // 1. Establish PostgreSQL database connection
    await connectToPostgres();

    // 2. Create HTTP server wrapping Express app
    const server = http.createServer(app);

    // 3. Initialize Socket.IO with WebSocket + polling support
    const io = initSocketServer(server);

    // 4. Start listening for incoming HTTP & WebSocket connections
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 NOD Server & Socket.IO running on port ${PORT} [env: ${db.env || process.env.NODE_ENV || "development"}]`);
      console.log(`🚀 NOD Server & Socket.IO running on http://0.0.0.0:${PORT}`);
    });

    // Graceful shutdown
    const handleShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      if (io) {
        io.close();
      }
      server.close(() => {
        logger.info("HTTP and Socket.IO server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    return server;
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
