import nodeMailer from "nodemailer";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";

// Ensure Node defaults to IPv4 first on cloud hosts (e.g. Render) where IPv6 has no route
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

async function getTransporterConfig() {
  let host = "smtp.gmail.com";
  try {
    const ipv4Addresses = await dnsPromises.resolve4("smtp.gmail.com");
    if (ipv4Addresses && ipv4Addresses.length > 0) {
      host = ipv4Addresses[0]; // Direct IPv4 IP skips Nodemailer's random IPv6 resolution
    }
  } catch (err) {
    console.warn("[emailService] IPv4 DNS resolution failed, fallback to hostname:", err.message);
  }

  return {
    host,
    port: 465,
    secure: true,
    servername: "smtp.gmail.com",
    tls: {
      servername: "smtp.gmail.com",
    },
    auth: {
      user: process.env.EMAIL_USER || "nodindiaconnect@gmail.com",
      pass: process.env.EMAIL_PASS || "wolf hxlt crif osta",
    },
  };
}

const FROM_EMAIL = "NOD <nodindiaconnect@gmail.com>";
const BRAND_NAME = "NOD";
const BRAND_TAGLINE = "Designing Timeless Spaces";
const SUPPORT_EMAIL = "nodindiaconnect@gmail.com";
const BRAND_URL = "https://yourdomain.com";

// ─── Shared CSS ────────────────────────────────────────────────────────────────
const BASE_STYLES = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Helvetica, Arial, sans-serif;
      background-color: #f0f4f8;
      padding: 20px;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 30px auto;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #00466a 0%, #006699 100%);
      padding: 24px 20px;
      text-align: center;
    }
    .header a, .header span {
      font-size: 1.9em;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .header-subtitle {
      color: rgba(255,255,255,0.8);
      font-size: 0.85em;
      margin-top: 4px;
    }
    .content {
      padding: 32px 30px;
      line-height: 1.7;
      color: #333333;
    }
    .content h2 {
      color: #00466a;
      margin-bottom: 12px;
      font-size: 1.3em;
    }
    .content p {
      margin-bottom: 12px;
      color: #444;
    }
    .info-box {
      background-color: #f0f8ff;
      border-left: 4px solid #00466a;
      border-radius: 6px;
      padding: 16px 18px;
      margin: 20px 0;
    }
    .info-box p { margin-bottom: 6px; color: #333; }
    .info-box p:last-child { margin-bottom: 0; }
    .success-box {
      background-color: #edfaf1;
      border-left: 4px solid #27ae60;
      border-radius: 6px;
      padding: 16px 18px;
      margin: 20px 0;
    }
    .success-box .icon { font-size: 1.6em; margin-bottom: 6px; display: block; }
    .success-box p { color: #1a6b3a; margin: 0; font-size: 1.05em; }
    .warning-box {
      background-color: #fffbea;
      border-left: 4px solid #f0a500;
      border-radius: 6px;
      padding: 14px 18px;
      margin: 20px 0;
      color: #7a5700;
      font-size: 0.9em;
    }
    .otp-box {
      background-color: #f0f8ff;
      border: 2px dashed #00466a;
      border-radius: 8px;
      padding: 22px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-size: 2.4em;
      font-weight: 800;
      color: #00466a;
      letter-spacing: 8px;
      margin: 8px 0;
    }
    .otp-validity {
      color: #666;
      font-size: 0.88em;
      margin-top: 8px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.78em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-pending   { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .badge-progress  { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
    .badge-resolved  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .badge-closed    { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }
    .badge-approved  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .badge-rejected  { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .badge-onhold    { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .btn-wrapper { text-align: center; margin: 28px 0; }
    .btn {
      display: inline-block;
      padding: 13px 32px;
      background-color: #00466a;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.95em;
      letter-spacing: 0.3px;
    }
    .divider {
      border: none;
      border-top: 1px solid #e8ecef;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #00466a; min-width: 140px; font-size: 0.9em; }
    .detail-value { color: #444; font-size: 0.9em; }
    .response-box {
      background: #f8fafb;
      border: 1px solid #d0dce6;
      border-radius: 6px;
      padding: 16px 18px;
      margin: 16px 0;
      color: #333;
    }
    .response-box .resp-by { font-weight: 600; color: #00466a; margin-bottom: 8px; font-size: 0.9em; }
    .footer {
      background-color: #f8fafb;
      padding: 20px;
      text-align: center;
      font-size: 0.82em;
      color: #999;
      border-top: 1px solid #e8ecef;
    }
    .footer strong { color: #00466a; }
    ul.tips { padding-left: 18px; color: #666; margin: 8px 0 0 0; }
    ul.tips li { margin-bottom: 4px; font-size: 0.9em; }
  </style>
`;

// ─── Shared Layout Wrappers ─────────────────────────────────────────────────
const emailOpen = (subtitle = "") => `
<!DOCTYPE html>
<html lang="en">
<head>${BASE_STYLES}</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <a href="${BRAND_URL}">${BRAND_NAME}</a>
        ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ""}
      </div>
      <div class="content">
`;

const emailClose = (year = new Date().getFullYear()) => `
      </div><!-- /content -->
      <div class="footer">
        <strong>${BRAND_NAME}</strong> — ${BRAND_TAGLINE}<br/>
        <span style="margin-top:6px;display:block;">This is an automated message. Please do not reply.</span>
        <span>© ${year} ${BRAND_NAME}. All rights reserved.</span>
      </div>
    </div><!-- /email-container -->
  </div><!-- /email-wrapper -->
</body>
</html>
`;

// ─── Email Service ───────────────────────────────────────────────────────────
class emailService {

  static async sendMail(email, subject, htmlContent) {
    console.log("──────────────────────────────────────────");
    console.log(`[emailService] Preparing to send email`);
    console.log(`[emailService] To: ${email}`);
    console.log(`[emailService] Subject: ${subject}`);

    try {
      const config = await getTransporterConfig();
      console.log(`[emailService] SMTP host: ${config.host}:${config.port} (servername: ${config.servername})`);
      console.log(`[emailService] SMTP user: ${config.auth.user}`);

      const transporter = nodeMailer.createTransport(config);

      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: email,
        subject,
        html: htmlContent,
      });

      console.log("[emailService] Email SENT successfully ✅");
      console.log(`[emailService] Message ID: ${info.messageId}`);
      console.log(`[emailService] Accepted: ${JSON.stringify(info.accepted)}`);
      console.log(`[emailService] Rejected: ${JSON.stringify(info.rejected)}`);
      console.log(`[emailService] Response: ${info.response}`);
      console.log("──────────────────────────────────────────");

      return info.messageId;
    } catch (error) {
      console.error("[emailService] Email FAILED to send ❌");
      console.error(`[emailService] Error name: ${error.name}`);
      console.error(`[emailService] Error message: ${error.message}`);
      console.error(`[emailService] Error code: ${error.code || "N/A"}`);
      console.error("[emailService] Full error:", error);
      console.log("──────────────────────────────────────────");
      throw error;
    }
  }

  static async sendOtpMail(email, name, otp, otpType) {
    console.log(`[emailService] sendOtpMail called — email: ${email}, otpType: ${otpType}, otp: ${otp}`);

    let subject, purpose, message;

    switch (otpType) {
      case "register":
        subject = `Verify Your ${BRAND_NAME} Account`;
        purpose = "Account Registration";
        message = `Thank you for registering with ${BRAND_NAME}! Please use the OTP below to verify your account.`;
        break;
      case "forgotPassword":
        subject = `Reset Your ${BRAND_NAME} Password`;
        purpose = "Password Reset";
        message = "We received a request to reset your password. Please use the OTP below to proceed.";
        break;
      case "changePassword":
      case "ChangePassword":
        subject = "Verify Password Change Request";
        purpose = "Password Change";
        message = "We received a request to change your password. Please use the OTP below to verify this change.";
        break;
      default:
        subject = `Your ${BRAND_NAME} OTP`;
        purpose = "Verification";
        message = "Please use the OTP below to complete your verification.";
    }

    const htmlContent = `
      ${emailOpen("Secure Verification")}
      <h2>Hello ${name || "User"},</h2>
      <p>${message}</p>

      <div class="otp-box">
        <p style="color:#666;font-size:0.88em;margin-bottom:4px;">Your OTP for <strong>${purpose}</strong></p>
        <div class="otp-code">${otp}</div>
        <p class="otp-validity">⏱ Valid for <strong>10 minutes</strong></p>
      </div>

      <p>If you didn't request this OTP, please ignore this email or contact our support team immediately.</p>

      <div class="warning-box">
        <strong>⚠️ Security Notice:</strong> Never share your OTP with anyone.
        ${BRAND_NAME} will never ask for your OTP via phone or email.
      </div>

      <p>Need help? Contact us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#00466a;">${SUPPORT_EMAIL}</a>
      </p>

      <p style="margin-top:24px;">Best regards,<br/><strong>The ${BRAND_NAME} Team</strong></p>
      ${emailClose()}
    `;

    try {
      const messageId = await this.sendMail(email, subject, htmlContent);
      console.log(`[emailService] sendOtpMail completed — messageId: ${messageId}`);
      return messageId;
    } catch (error) {
      console.error(`[emailService] sendOtpMail FAILED for ${email}:`, error.message);
      throw error;
    }
  }



  static async sendPopupLeadMail(lead, recipients) {
    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const subject = `New Lead Inquiry — ${lead.name}`;

    const htmlContent = `
    ${emailOpen("New Lead Inquiry")}

    <h2>New Lead Inquiry</h2>

    <p>
      A new customer inquiry has been received through the website.
      Please review the lead details below and follow up at your earliest convenience.
    </p>

    <div class="info-box">
      <div class="detail-row">
        <div class="detail-label">Name</div>
        <div class="detail-value">${escapeHtml(lead.name)}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Phone</div>
        <div class="detail-value">
          ${escapeHtml(lead.countryCode || "")} ${escapeHtml(lead.phone)}
        </div>
      </div>
    </div>

    ${lead.details
        ? `
    <div class="response-box">
      <div class="resp-by">Inquiry Details</div>
      <p>${escapeHtml(lead.details)}</p>
    </div>
    `
        : ""
      }

    <p style="margin-top:24px;">
      Kindly review this inquiry and contact the customer as soon as possible.
    </p>

    ${emailClose()}
  `;

    const results = [];

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return results;
    }

    for (const recipient of recipients) {
      try {
        const messageId = await this.sendMail(recipient, subject, htmlContent);

        results.push({
          email: recipient,
          success: true,
          messageId,
        });
      } catch (error) {
        results.push({
          email: recipient,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  static async sendContactSectionLeadMail(lead, recipients) {
    console.log(`[emailService] sendContactSectionLeadMail called — leadId: ${lead.id}`);
    console.log(`[emailService] Recipients: ${JSON.stringify(recipients)}`);

    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const subject = `New Contact Lead — ${lead.name}`;

    const htmlContent = `
      ${emailOpen("New Contact Lead")}
      <h2>New Lead from Contact Section</h2>
      <p>A new contact form submission has come in. Details below:</p>

      <div class="info-box">
        <div class="detail-row">
          <div class="detail-label">Name</div>
          <div class="detail-value">${escapeHtml(lead.name)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Phone</div>
          <div class="detail-value">${escapeHtml(lead.countryCode || "")} ${escapeHtml(lead.phone)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Email</div>
          <div class="detail-value">${escapeHtml(lead.email) || "—"}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Company</div>
          <div class="detail-value">${escapeHtml(lead.company) || "—"}</div>
        </div>
     
      </div>

      ${lead.details ? `
      <div class="response-box">
        <div class="resp-by">Message</div>
        <p>${escapeHtml(lead.details)}</p>
      </div>
      ` : ""}

      <p style="margin-top:24px;">Please follow up with this lead as soon as possible.</p>
      ${emailClose()}
    `;

    const results = [];

    if (!Array.isArray(recipients) || recipients.length === 0) {
      console.warn("[emailService] sendContactSectionLeadMail called with no recipients — nothing to send");
      return results;
    }

    for (const recipient of recipients) {
      try {
        const messageId = await this.sendMail(recipient, subject, htmlContent);
        console.log(`[emailService] ✅ Sent to ${recipient} — messageId: ${messageId}`);
        results.push({ email: recipient, success: true, messageId });
      } catch (error) {
        console.error(`[emailService] ❌ FAILED to send to ${recipient}: ${error.message}`);
        results.push({ email: recipient, success: false, error: error.message });
      }
    }

    const sentCount = results.filter(r => r.success).length;
    const failedCount = results.length - sentCount;

    console.log(`[emailService] sendContactSectionLeadMail summary for lead ${lead.id}: ${sentCount} sent, ${failedCount} failed out of ${results.length} total`);
    if (failedCount > 0) {
      console.warn(
        `[emailService] Failed recipients: ${results.filter(r => !r.success).map(r => r.email).join(", ")}`
      );
    }

    return results;
  }



  static async sendAdminUserCreationMail(email, password, permissions, name) {
    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const subject = `Your ${BRAND_NAME} Admin Account Has Been Created`;

    const permissionsList = Array.isArray(permissions) && permissions.length > 0
      ? permissions.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
      : "<li>No permissions assigned</li>";

    const htmlContent = `
    ${emailOpen("Admin Account Created")}
    <h2>Hello ${escapeHtml(name) || "Admin"},</h2>
    <p>An admin account has been created for you on ${BRAND_NAME}. Below are your login credentials.</p>

    <div class="info-box">
      <div class="detail-row">
        <div class="detail-label">Email</div>
        <div class="detail-value">${escapeHtml(email)}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Password</div>
        <div class="detail-value">${escapeHtml(password)}</div>
      </div>
    </div>

    <p><strong>Assigned Permissions:</strong></p>
    <ul class="tips">
      ${permissionsList}
    </ul>



    <p>Need help? Contact us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#00466a;">${SUPPORT_EMAIL}</a>
    </p>

    <p style="margin-top:24px;">Best regards,<br/><strong>The ${BRAND_NAME} Team</strong></p>
    ${emailClose()}
  `;

    try {
      const messageId = await this.sendMail(email, subject, htmlContent);
      return messageId;
    } catch (error) {
      throw error;
    }
  }


}
export default emailService;