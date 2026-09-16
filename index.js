import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import app from "./app.js";

// Configure default options for 2nd Gen Firebase Cloud Functions
setGlobalOptions({
  region: process.env.FIREBASE_REGION || "asia-south1",
  maxInstances: 10,
  timeoutSeconds: 120,
  memory: "512MiB",
});

/**
 * Main Firebase Cloud Function exposing the Express REST backend.
 * Accessible at: https://<region>-<project-id>.cloudfunctions.net/api
 * Or via Firebase Hosting rewrites.
 */
export const api = onRequest(
  {
    cors: false, // Handled by Express helmet & cors middleware
    invoker: "public",
  },
  app
);
