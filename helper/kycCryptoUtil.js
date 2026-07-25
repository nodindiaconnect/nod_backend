// import crypto from "crypto";
// import db from "../config/db.js";

// const ALGO = "aes-256-gcm";

// const KEY = Buffer.from(db.KYC_AES_KEY, "hex");
// export const encryptKyc = (value) => {
//   const iv = crypto.randomBytes(12);
//   const cipher = crypto.createCipheriv(ALGO, KEY, iv);

//   let encrypted = cipher.update(value, "utf8", "hex");
//   encrypted += cipher.final("hex");

//   const authTag = cipher.getAuthTag();

//   return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
// };

// export const decryptKyc = (payload) => {
//   const [ivHex, tagHex, encrypted] = payload.split(":");

//   const decipher = crypto.createDecipheriv(
//     ALGO,
//     KEY,
//     Buffer.from(ivHex, "hex")
//   );

//   decipher.setAuthTag(Buffer.from(tagHex, "hex"));

//   let decrypted = decipher.update(encrypted, "hex", "utf8");
//   decrypted += decipher.final("utf8");

//   return decrypted;
// };

// export function hashValue(value) {
//   return crypto.createHash("sha256").update(value).digest("hex");
// }
