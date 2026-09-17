import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import app from "./app.js";

setGlobalOptions({
  maxInstances: 10,
});

export const api = onRequest(
  {
    region: "asia-south1",
    invoker: "public",
  },
  app
);