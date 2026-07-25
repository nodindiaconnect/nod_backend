

// import pkg from "pg";
// import logger from "../helper/logger.js";

// const { Pool } = pkg;

// console.log("========== PostgreSQL Config ==========");
// console.log("DB_HOST:", process.env.DB_HOST);
// console.log("DB_PORT:", process.env.DB_PORT);
// console.log("DB_USER:", process.env.DB_USER);
// console.log("DB_NAME:", process.env.DB_NAME);
// console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "Loaded ✅" : "Not Found ❌");
// console.log("=======================================");

// const pgPool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

// async function connectToPostgres() {
//   try {

//     const client = await pgPool.connect();

//     console.log("✅ PostgreSQL Connected Successfully!");
//     console.log("Host:", process.env.DB_HOST);
//     console.log("Database:", process.env.DB_NAME);
//     console.log("User:", process.env.DB_USER);

//     logger.info("Postgres connected successfully");

//     client.release();
//     console.log("Connection released.");
//   } catch (error) {
//     console.error("❌ PostgreSQL Connection Failed");
//     console.error("Error Message:", error.message);
//     console.error("Error Code:", error.code);
//     console.error("Full Error:", error);

//     logger.error("Error connecting to Postgres:", error);
//   }
// }

// export { pgPool, connectToPostgres };


import pkg from "pg";
import logger from "../helper/logger.js";
import db from "../config/db.js"; // adjust path to wherever your db.js actually lives

const { Pool } = pkg;

console.log("========== PostgreSQL Config ==========");
console.log("ENV:", db.env);
console.log("DB_HOST:", db.DB_HOST);
console.log("DB_PORT:", db.DB_PORT);
console.log("DB_USER:", db.DB_USER);
console.log("DB_NAME:", db.DB_NAME);
console.log("DB_PASSWORD:", db.DB_PASSWORD ? "Loaded ✅" : "Not Found ❌");
console.log("=======================================");

const pgPool = new Pool({
  host: db.DB_HOST,
  port: db.DB_PORT,
  user: db.DB_USER,
  password: db.DB_PASSWORD,
  database: db.DB_NAME,
  // If you're using DATABASE_URL instead, use this and drop the fields above:
  // connectionString: db.DATABASE_URL,
});

async function connectToPostgres() {
  try {
    const client = await pgPool.connect();

    console.log("✅ PostgreSQL Connected Successfully!");
    console.log("Env:", db.env);
    console.log("Host:", db.DB_HOST);
    console.log("Database:", db.DB_NAME);
    console.log("User:", db.DB_USER);

    logger.info(`Postgres connected successfully (${db.env})`);

    client.release();
    console.log("Connection released.");
  } catch (error) {
    console.error("❌ PostgreSQL Connection Failed");
    console.error("Error Message:", error.message);
    console.error("Error Code:", error.code);
    console.error("Full Error:", error);

    logger.error("Error connecting to Postgres:", error);
  }
}

export { pgPool, connectToPostgres };
