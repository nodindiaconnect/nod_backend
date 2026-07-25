import Redis from "ioredis";
import logger from "../helper/logger.js";
import dotenv from "dotenv";
dotenv.config();

const BASE = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  keepAlive: 10_000,
};

function createClient(name, options) {
  const client = new Redis(options);
  client.on("connect", () => logger.info(`[Redis:${name}] Connected`));
  client.on("error", (e) => logger.error(`[Redis:${name}] ${e.message}`));
  client.on("reconnecting", (ms) =>
    logger.warn(`[Redis:${name}] Reconnecting in ${ms}ms`),
  );
  return client;
}

export const bullRedis = createClient("bull", {
  ...BASE,
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(100 * 2 ** times, 10_000),
});

export default createClient("app", {
  ...BASE,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 3_000)),
});
