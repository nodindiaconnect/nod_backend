// import winston from "winston";
// import DailyRotateFile from "winston-daily-rotate-file";
// import WinstonCloudWatch from "winston-cloudwatch";
// import path from "path";
// import fs from "fs";
// import { fileURLToPath } from "url";
// import { CronJob } from "cron";
// import db from "../config/db.js";

// // Get the current directory in an ES module
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const logLevel = "info";
// const logPath = process.env.NODE_ENV === "development" ? "logs" : "/var/log/jaimax";
// const logDirectory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", logPath) : logPath;

// if (!fs.existsSync(logDirectory)) {
//   fs.mkdirSync(logDirectory, { recursive: true });
// }

// // Function to get the current day
// function getCurrentDay() {
//   const currentDate = new Date();
//   const year = currentDate.getFullYear();
//   const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
//   const day = currentDate.getDate().toString().padStart(2, "0");
//   return `${year}-${month}-${day}`;
// }

// // Function to create CloudWatch transport
// function createCloudWatchTransport() {
//   return new WinstonCloudWatch({
//     logGroupName: "api.jaimax.com",
//     logStreamName: `${db.env}-stream-${getCurrentDay()}`, // ✅ Dynamic stream name
//     awsRegion: db.region,
//     jsonMessage: true,
//     awsOptions: {
//       credentials: {
//         accessKeyId: db.accessKey,
//         secretAccessKey: db.secretKey,
//       },
//     },
//   });
// }

// let cloudWatchTransport = createCloudWatchTransport(); // Initialize CloudWatch Transport
// let currentDate = getCurrentDay(); // Track current date

// // Define the transports for logging (console and file rotation)
// const transports = [
//   new DailyRotateFile({
//     filename: path.join(logDirectory, "jaimax-all-logs-%DATE%.log"),
//     datePattern: "YYYY-MM-DD",
//     maxSize: "5m",
//     maxFiles: "14d",
//   }),
//   new DailyRotateFile({
//     filename: path.join(logDirectory, "jaimax-error-logs-%DATE%.log"),
//     level: "error",
//     datePattern: "YYYY-MM-DD",
//     maxSize: "5m",
//     maxFiles: "14d",
//   }),
// ];

// // Add CloudWatch transport in production
// if (process.env.NODE_ENV === "qa") {
//   transports.push(cloudWatchTransport);
// }

// // Add console transport for local environments
// if (process.env.NODE_ENV !== "production") {
//   transports.push(
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.json()
//       ),
//     })
//   );
// }

// // Create the logger instance
// const logger = winston.createLogger({
//   level: logLevel,
//   format: winston.format.combine(
//     winston.format.timestamp({ format: "DD/MM/YYYY hh:mm:ss a" }),
//     winston.format.json()
//   ),
//   transports,
// });

// // 🔹 **Cron Job to Rotate CloudWatch Logs at Midnight (Every Day)**
// const job = new CronJob("0 0 * * *", () => {
//   logger.info(`🌙 Midnight log rotation: Switching from ${currentDate} to a new log stream.`);

//   cloudWatchTransport.kthxbye(() => {
//     logger.info("✅ Old CloudWatch logs flushed.");

//     // Update current date
//     currentDate = getCurrentDay();

//     // Remove old transport
//     logger.remove(cloudWatchTransport);

//     // Create and add new transport
//     cloudWatchTransport = createCloudWatchTransport();
//     logger.add(cloudWatchTransport);

//     logger.info(`🚀 Switched to new log stream: ${db.env}-stream-${currentDate}`);
//   });
// });

// // ✅ Start the cron job
// job.start();

// export default logger;

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import WinstonCloudWatch from "winston-cloudwatch";
import path from "path";
import fs from "fs";
import { CronJob } from "cron";
import db from "../config/db.js";

const logLevel = "info";

// Render-safe writable directory
const logDirectory = path.join(process.cwd(), "logs");

// Create logs folder if it does not exist
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Get current date
function getCurrentDay() {
  const currentDate = new Date();

  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1)
    .toString()
    .padStart(2, "0");

  const day = currentDate
    .getDate()
    .toString()
    .padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Create CloudWatch transport
function createCloudWatchTransport() {
  return new WinstonCloudWatch({
    logGroupName: "api.jaimax.com",

    logStreamName: `${db.env}-stream-${getCurrentDay()}`,

    awsRegion: db.region,

    jsonMessage: true,

    awsOptions: {
      credentials: {
        accessKeyId: db.accessKey,
        secretAccessKey: db.secretKey,
      },
    },
  });
}

let cloudWatchTransport = null;
let currentDate = getCurrentDay();

// Logging transports
const transports = [
  // All logs file
  new DailyRotateFile({
    filename: path.join(
      logDirectory,
      "jaimax-all-logs-%DATE%.log"
    ),
    datePattern: "YYYY-MM-DD",
    maxSize: "5m",
    maxFiles: "14d",
  }),

  // Error logs file
  new DailyRotateFile({
    filename: path.join(
      logDirectory,
      "jaimax-error-logs-%DATE%.log"
    ),
    level: "error",
    datePattern: "YYYY-MM-DD",
    maxSize: "5m",
    maxFiles: "14d",
  }),

  // Always show logs in Render console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({
        format: "DD/MM/YYYY hh:mm:ss a",
      }),
      winston.format.json()
    ),
  }),
];

// Add CloudWatch only for QA
if (process.env.NODE_ENV === "qa") {
  try {
    cloudWatchTransport =
      createCloudWatchTransport();

    transports.push(cloudWatchTransport);
  } catch (error) {
    console.error(
      "CloudWatch logger initialization failed:",
      error
    );
  }
}

// Create logger
const logger = winston.createLogger({
  level: logLevel,

  format: winston.format.combine(
    winston.format.timestamp({
      format: "DD/MM/YYYY hh:mm:ss a",
    }),

    winston.format.json()
  ),

  transports,
});

// Rotate CloudWatch stream every midnight
const job = new CronJob("0 0 * * *", () => {
  // Only run CloudWatch rotation in QA
  if (
    process.env.NODE_ENV !== "qa" ||
    !cloudWatchTransport
  ) {
    return;
  }

  logger.info(
    `Midnight log rotation: Switching from ${currentDate} to a new log stream.`
  );

  cloudWatchTransport.kthxbye(() => {
    logger.info(
      "Old CloudWatch logs flushed."
    );

    currentDate = getCurrentDay();

    logger.remove(cloudWatchTransport);

    cloudWatchTransport =
      createCloudWatchTransport();

    logger.add(cloudWatchTransport);

    logger.info(
      `Switched to new log stream: ${db.env}-stream-${currentDate}`
    );
  });
});

// Start cron job
job.start();

export default logger;

