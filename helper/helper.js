import axios from "axios";
import NodeCache from "node-cache";
import nodeMailer from "nodemailer";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import prisma from "../config/prismaClient.js";

let envfile = process.env;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const myCache = new NodeCache();

// const s3 = new S3Client({
//   credentials: {
//     accessKeyId: db.accessKey,
//     secretAccessKey: db.secretKey,
//   },
//   region: db.region,
// });

class helper {
  static async success(res, msg, data = {}) {
    return res.status(200).send({
      success: 1,
      status_code: 200,
      message: msg,
      data: data,
    });
  }
  static async failed(res, msg, data = {}, code = 400) {
    return res.status(code).send({
      success: 0,
      status_code: code,
      message: msg,
      data: data,
    });
  }
  static async err(res, err, path = "/", code = 500) {
    let err_log = await prisma.logs.create({
      data: {
        path: path,
        err: err && err.response ? err.response.data : err.message,
        errMessage: err && err.response ? err.response.data : err.message,
        errDate: new Date(),
      },
    });
    return res.status(code).send({
      success: 0,
      status_code: code,
      message: err.message,
      data: {},
    });
  }
  static async generateOTP() {
    let OTP = await Math.floor(100000 + Math.random() * 900000);
    return OTP;
  }

  static async nodeMailer(email, otp) {
    try {
      const response = await mg.messages.create(MAILGUN_DOMAIN, {
        from: FROM_EMAIL,
        to: email,
        subject: "karrivo",
        html: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
                <div style="margin:50px auto;width:70%;padding:20px 0">
                  <div style="border-bottom:1px solid #eee">
                    <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Jaimax</a>
                  </div>
                  <p style="font-size:1.1em">Hi,</p>
                  <p>Thank you for choosing karrivo. Use the following OTP to complete. OTP is valid for 10 minutes</p>
                  <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${otp}</h2>
                  <p style="font-size:0.9em;">Regards,<br />karrivo</p>
                  <hr style="border:none;border-top:1px solid #eee" />
                  <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
                    <p>Karrivo</p>
                   
                  </div>
                </div>
              </div>`,
      });

      console.log("Message sent: %s", response.id);
      return response.id;
    } catch (error) {
      console.error("Error sending OTP mail:", error);
      throw error;
    }
  }

  // Generate random password
  static generateRandomPassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  static generateResetToken(length = 64) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < length; i++) {
      token += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return token;
  }
}

export default helper;