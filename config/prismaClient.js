import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import db from "./db.js";

const connectionString =
  db?.DATABASE_URL ||
  process.env.DATABASE_URL_PROD ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ CRITICAL: No database connection URL found in environment (checked db.DATABASE_URL, DATABASE_URL_PROD, and DATABASE_URL)!");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export default prisma;