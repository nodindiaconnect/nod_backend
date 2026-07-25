import { config } from "dotenv";
config();

let db = {};

if (process.env.NODE_ENV === "development") {
  db.env = "development";

  // App
  db.PORT = process.env.LOCAL_PORT;
  db.baseURL = process.env.BACKEND_BASE_URL_DEV;
  db.frontEndBaseURL = process.env.FRONTEND_BASE_URL_DEV;

  // Auth
  db.JWT_SK = process.env.JWT_SK;

  // Postgres
  db.DB_HOST = process.env.DB_HOST;
  db.DB_PORT = process.env.DB_PORT;
  db.DB_USER = process.env.DB_USER;
  db.DB_PASSWORD = process.env.DB_PASSWORD;
  db.DB_NAME = process.env.DB_NAME;
  db.DATABASE_URL = process.env.DATABASE_URL;
} else {
  db.env = "production";

  // App
  db.PORT = process.env.PROD_PORT;
  db.baseURL = process.env.BACKEND_BASE_URL_PROD;
  db.frontEndBaseURL = process.env.FRONTEND_BASE_URL_PROD;

  // Auth
  db.JWT_SK = process.env.JWT_SK_PROD;

  // Postgres
  db.DB_HOST = process.env.DB_HOST_PROD;
  db.DB_PORT = process.env.DB_PORT_PROD;
  db.DB_USER = process.env.DB_USER_PROD;
  db.DB_PASSWORD = process.env.DB_PASSWORD_PROD;
  db.DB_NAME = process.env.DB_NAME_PROD;
  db.DATABASE_URL = process.env.DATABASE_URL_PROD;
}

export default db;