import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

let razorpayInstance = null;

/**
 * Get or initialize the Razorpay SDK instance singleton using environment variables.
 */
export const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.key_id;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.key_secret;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are missing in environment variables",
    );
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
};

/**
 * Get configured Razorpay Key ID
 */
export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID || process.env.key_id || "";
};

/**
 * Get configured Razorpay Key Secret (Backend-only internal usage)
 */
export const getRazorpayKeySecret = () => {
  return process.env.RAZORPAY_KEY_SECRET || process.env.key_secret || "";
};

export default getRazorpayInstance;
