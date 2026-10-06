import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import PDFDocument from "pdfkit";
import InvoiceService from "./invoiceService.js";
import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

// List of candidate Chrome / Chromium binary paths across environments
const CHROME_PATHS = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
].filter(Boolean);

function findChromeExecutable() {
    for (const exePath of CHROME_PATHS) {
        if (fs.existsSync(exePath)) {
            return exePath;
        }
    }
    return null;
}

class InvoicePdfService {
    /**
     * Build rich HTML matching the official NOD Tax Invoice specification
     */
    static buildInvoiceHtml(invoice, project) {
        const invoiceDate = invoice.paidAt
            ? new Date(invoice.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

        const milestoneAmount = Number(invoice.milestoneAmount || 0);
        const platformFee = Number(invoice.platformFeeAmount || 0);
        const totalPaid = Number(invoice.totalAmountPaid || milestoneAmount + platformFee);

        // GST calculations (18% on platform fee)
        const gstRate = 18;
        const gstAmount = platformFee > 0 ? Math.round(platformFee * (gstRate / (100 + gstRate))) : 0;
        const netFee = platformFee - gstAmount;
        const cgstAmount = Math.round(gstAmount / 2);
        const sgstAmount = gstAmount - cgstAmount;

        // 4% non-refundable advisory amount
        const nonRefundableAmount = Math.round(milestoneAmount * 0.04);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Tax Invoice - ${invoice.invoiceNumber}</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #FFFFFF;
    color: #1E293B;
    position: relative;
    padding: 36px 44px 70px 44px;
    height: 100vh;
  }

  /* Watermark background */
  .watermark {
    position: fixed;
    top: 48%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 440px;
    height: 440px;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }

  /* Header Section */
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .brand-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo-circle {
    width: 74px;
    height: 74px;
    border-radius: 50%;
    border: 2px solid #005B7F;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #FFFFFF;
    box-shadow: 0 2px 6px rgba(0,91,127,0.12);
  }

  .logo-circle span.nod-badge-text {
    font-size: 7px;
    font-weight: 800;
    color: #005B7F;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
    line-height: 1.1;
  }

  .logo-circle svg {
    width: 32px;
    height: 32px;
    color: #005B7F;
    margin: 1px 0;
  }

  .brand-text h1 {
    font-size: 34px;
    font-weight: 900;
    color: #003652;
    letter-spacing: 1px;
    line-height: 1;
  }

  .brand-text .sub-title {
    color: #009688;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-top: 4px;
    text-transform: uppercase;
  }

  .brand-text .udyam-no {
    color: #334155;
    font-size: 10px;
    font-weight: 700;
    margin-top: 5px;
    letter-spacing: 0.3px;
  }

  .supplier-right {
    max-width: 290px;
    text-align: right;
    font-size: 10px;
    color: #334155;
    line-height: 1.45;
  }

  .supplier-right .contact-item {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin-bottom: 4px;
  }

  .supplier-right .contact-item svg {
    width: 14px;
    height: 14px;
    color: #009688;
    flex-shrink: 0;
  }

  .gst-badge {
    display: inline-block;
    background: #E0F2F1;
    color: #004D40;
    border: 1px solid #80CBC4;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    margin-top: 4px;
  }

  /* Teal Divider Bar */
  .bar-divider {
    height: 6px;
    background: linear-gradient(90deg, #005B7F 0%, #009688 100%);
    border-radius: 3px;
    margin: 10px 0 16px 0;
  }

  /* Invoice Title Bar */
  .invoice-title-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 22px;
  }

  .invoice-title-line {
    flex: 1;
    height: 1.5px;
    background: #009688;
  }

  .invoice-title-text {
    font-size: 24px;
    font-weight: 900;
    color: #003652;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  /* 2-Column Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 22px;
    position: relative;
    z-index: 1;
  }

  .info-card {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 14px 16px;
    font-size: 11px;
  }

  .info-card h4 {
    font-size: 11px;
    font-weight: 800;
    color: #005B7F;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #E2E8F0;
    padding-bottom: 6px;
    margin-bottom: 10px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  .info-label {
    color: #64748B;
    font-weight: 600;
  }

  .info-val {
    font-weight: 700;
    color: #0F172A;
    text-align: right;
  }

  .badge-status {
    background: #DCFCE7;
    color: #15803D;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    display: inline-block;
  }

  /* Table */
  table.items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 11px;
    position: relative;
    z-index: 1;
  }

  table.items-table th {
    background: #003652;
    color: #FFFFFF;
    padding: 9px 12px;
    text-align: left;
    font-weight: 700;
    letter-spacing: 0.4px;
  }

  table.items-table th.text-right {
    text-align: right;
  }

  table.items-table td {
    padding: 9px 12px;
    border-bottom: 1px solid #E2E8F0;
    color: #1E293B;
  }

  table.items-table td.text-right {
    text-align: right;
  }

  table.items-table tr.alt {
    background: #F8FAFC;
  }

  table.items-table tr.total-row td {
    background: #F1F5F9;
    font-weight: 800;
    font-size: 13px;
    color: #003652;
    border-top: 2px solid #005B7F;
    border-bottom: 2px solid #005B7F;
  }

  /* Non-refundable Disclosure Box */
  .disclosure-box {
    background: #EFF6FF;
    border-left: 3px solid #005B7F;
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 10px;
    line-height: 1.5;
    color: #1E3A8A;
    margin-bottom: 22px;
    position: relative;
    z-index: 1;
  }

  .disclosure-box strong {
    color: #005B7F;
  }

  /* Footer Social Bar */
  .footer-social-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #003652;
    color: #FFFFFF;
    padding: 12px 30px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    font-size: 10px;
    z-index: 10;
  }

  .social-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .social-icon {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 11px;
  }

  .social-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .social-label {
    font-size: 8px;
    color: #94A3B8;
    text-transform: uppercase;
  }

  .social-val {
    font-weight: 700;
    color: #FFFFFF;
  }
</style>
</head>
<body>

  <!-- Watermark -->
  <svg class="watermark" viewBox="0 0 100 100" fill="currentColor">
    <circle cx="50" cy="50" r="46" stroke="#005B7F" stroke-width="4" fill="none" />
    <circle cx="50" cy="50" r="38" stroke="#009688" stroke-width="1.5" fill="none" />
    <path d="M35 65 Q 50 25 65 65" stroke="#005B7F" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="43" cy="45" r="4" fill="#005B7F"/>
    <circle cx="57" cy="45" r="4" fill="#005B7F"/>
  </svg>

  <!-- Header -->
  <div class="header-container">
    <div class="brand-left">
      <div class="logo-circle">
        <span class="nod-badge-text">Night Owl</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
        <span class="nod-badge-text">NOD</span>
      </div>
      <div class="brand-text">
        <h1>NOD</h1>
        <div class="sub-title">— Night Owl Designers —</div>
        <div class="udyam-no">UDYAM NO. UDYAM-MP-08-0041277</div>
      </div>
    </div>

    <div class="supplier-right">
      <div class="contact-item">
        <span>Nightowldesignershelp@gmail.com</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </div>
      <div class="contact-item">
        <span>NOD office, 1st floor beside uday amrik homes main gate itarsi road sadar betul 460001 MP</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <span class="gst-badge">GSTIN: 23PQPPS9344H1ZV</span>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div class="bar-divider"></div>

  <!-- Title -->
  <div class="invoice-title-wrapper">
    <div class="invoice-title-line"></div>
    <div class="invoice-title-text">INVOICE</div>
    <div class="invoice-title-line"></div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <!-- Billed To -->
    <div class="info-card">
      <h4>Billed To (Client / Recipient)</h4>
      <div class="info-row">
        <span class="info-label">Name:</span>
        <span class="info-val">${invoice.clientName || "Client"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Contact Phone:</span>
        <span class="info-val">${invoice.clientPhone || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email Address:</span>
        <span class="info-val">${invoice.clientEmail || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Project:</span>
        <span class="info-val">${project?.title || "Project #" + invoice.projectId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Delivery Type:</span>
        <span class="info-val">${project?.projectDeliveryType || "2D + 3D Complete"}</span>
      </div>
    </div>

    <!-- Invoice Details -->
    <div class="info-card">
      <h4>Invoice & Payment Details</h4>
      <div class="info-row">
        <span class="info-label">Invoice Number:</span>
        <span class="info-val">${invoice.invoiceNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Invoice Date:</span>
        <span class="info-val">${invoiceDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Razorpay Payment ID:</span>
        <span class="info-val" style="font-family: monospace;">${invoice.transactionId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Escrow Status:</span>
        <span class="badge-status">CONFIRMED & HELD IN ESCROW</span>
      </div>
      <div class="info-row">
        <span class="info-label">Milestone Share:</span>
        <span class="info-val">Milestone #${invoice.milestoneSequence} (${invoice.milestonePercentage}%)</span>
      </div>
    </div>
  </div>

  <!-- Line Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 45px;">S.No</th>
        <th>Line Item Description</th>
        <th style="width: 100px;">Rate / %</th>
        <th class="text-right" style="width: 130px;">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <strong>${invoice.milestoneTitle || `Project Milestone #${invoice.milestoneSequence}`}</strong><br/>
          <span style="font-size: 9px; color: #64748B;">Phase ${invoice.milestoneSequence} approved milestone deliverables</span>
        </td>
        <td>${invoice.milestonePercentage}%</td>
        <td class="text-right">₹ ${milestoneAmount.toLocaleString("en-IN")}</td>
      </tr>
      ${platformFee > 0 ? `
      <tr class="alt">
        <td>2</td>
        <td>
          <strong>NOD Platform Technology & Escrow Fee</strong><br/>
          <span style="font-size: 9px; color: #64748B;">Platform service charge for tripartite contract protection</span>
        </td>
        <td>${invoice.platformFeeRate}%</td>
        <td class="text-right">₹ ${netFee.toLocaleString("en-IN")}</td>
      </tr>
      <tr>
        <td>3</td>
        <td>
          <strong>Goods and Services Tax (GST 18%)</strong><br/>
          <span style="font-size: 9px; color: #64748B;">CGST 9% (₹${cgstAmount.toLocaleString("en-IN")}) + SGST 9% (₹${sgstAmount.toLocaleString("en-IN")})</span>
        </td>
        <td>18%</td>
        <td class="text-right">₹ ${gstAmount.toLocaleString("en-IN")}</td>
      </tr>
      ` : ""}
      <tr class="total-row">
        <td colspan="3" class="text-right" style="text-align: right; padding-right: 20px;">
          TOTAL AMOUNT PAID:
        </td>
        <td class="text-right" style="color: #005B7F; font-size: 14px;">
          ₹ ${totalPaid.toLocaleString("en-IN")}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Non-Refundable Disclosure & Notice -->
  <div class="disclosure-box">
    <strong>Statutory Escrow & Refund Policy:</strong><br/>
    • <strong>4% Non-Refundable Fee:</strong> An administrative fee of 4% (₹ ${nonRefundableAmount.toLocaleString("en-IN")}) is non-refundable upon payment confirmation to cover banking, gateway, and contractual escrow infrastructure.<br/>
    • <strong>Dispute Settlement:</strong> In the event of a dispute, client refunds are calculated strictly as: <em>Refund = Total Paid - (Admin Approved Specialist Settlement + 4% Non-Refundable Fee)</em>.<br/>
    • <strong>Recipient Transparency:</strong> When NOD India executes refunds or designer payouts, the corresponding recipient user details and NOD India transaction references are recorded in the immutable ledger.
  </div>

  <!-- Bottom Social Footer Bar -->
  <div class="footer-social-bar">
    <div class="social-item">
      <div class="social-icon">📷</div>
      <div class="social-text">
        <span class="social-label">Instagram</span>
        <span class="social-val">nodindia.in</span>
      </div>
    </div>
    <div class="social-item">
      <div class="social-icon">𝕏</div>
      <div class="social-text">
        <span class="social-label">X (Twitter)</span>
        <span class="social-val">NODIndia</span>
      </div>
    </div>
    <div class="social-item">
      <div class="social-icon">in</div>
      <div class="social-text">
        <span class="social-label">LinkedIn</span>
        <span class="social-val">NOD INDIA</span>
      </div>
    </div>
    <div class="social-item">
      <div class="social-icon">✉️</div>
      <div class="social-text">
        <span class="social-label">Gmail</span>
        <span class="social-val">Nightowldesignershelp@gmail.com</span>
      </div>
    </div>
  </div>

</body>
</html>`;
    }

    /**
     * Generate Invoice PDF buffer using Puppeteer (or PDFKit fallback)
     * @param {string} invoiceId 
     * @param {object} userOrAdmin 
     * @returns {Promise<Buffer>}
     */
    static async generateInvoicePdfBuffer(invoiceId, userOrAdmin) {
        const invoice = await InvoiceService.getInvoiceById(invoiceId, userOrAdmin);
        const project = await prisma.project.findUnique({
            where: { id: invoice.projectId },
            select: { id: true, title: true, location: true, category: true, projectType: true, projectDeliveryType: true, totalCost: true },
        });

        const chromePath = findChromeExecutable();

        if (chromePath) {
            try {
                logger.info(`[InvoicePdfService] Launching Puppeteer with browser: ${chromePath}`);
                const browser = await puppeteer.launch({
                    executablePath: chromePath,
                    headless: "new",
                    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                });

                const page = await browser.newPage();
                const html = InvoicePdfService.buildInvoiceHtml(invoice, project);
                await page.setContent(html, { waitUntil: "networkidle0" });

                const pdfUint8Array = await page.pdf({
                    format: "A4",
                    printBackground: true,
                    margin: { top: 0, bottom: 0, left: 0, right: 0 },
                });

                await browser.close();
                return Buffer.from(pdfUint8Array);
            } catch (pupErr) {
                logger.error(`[InvoicePdfService] Puppeteer PDF rendering failed: ${pupErr.message}. Falling back to PDFKit.`);
            }
        } else {
            logger.warn("[InvoicePdfService] No local Chrome/Chromium found. Falling back to PDFKit generation.");
        }

        // PDFKit Fallback
        return await new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({ size: "A4", margins: { top: 35, bottom: 35, left: 40, right: 40 } });
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", (err) => reject(err));

            doc.fontSize(16).font("Helvetica-Bold").text("NIGHT OWL DESIGNERS (NOD)", 40, 40);
            doc.fontSize(10).font("Helvetica").text("UDYAM NO. UDYAM-MP-08-0041277 | GSTIN: 23PQPPS9344H1ZV", 40, 60);
            doc.fontSize(9).text("Nightowldesignershelp@gmail.com • Betul, Madhya Pradesh", 40, 75);
            doc.moveDown(2);
            doc.fontSize(14).font("Helvetica-Bold").text(`TAX INVOICE: ${invoice.invoiceNumber}`);
            doc.fontSize(9).font("Helvetica").text(`Date: ${new Date(invoice.paidAt || Date.now()).toLocaleDateString("en-IN")}`);
            doc.text(`Client: ${invoice.clientName} (${invoice.clientEmail || ""})`);
            doc.text(`Transaction ID: ${invoice.transactionId}`);
            doc.text(`Milestone #${invoice.milestoneSequence}: ₹ ${Number(invoice.milestoneAmount).toLocaleString("en-IN")}`);
            doc.text(`Platform Fee: ₹ ${Number(invoice.platformFeeAmount).toLocaleString("en-IN")}`);
            doc.text(`Total Paid: ₹ ${Number(invoice.totalAmountPaid).toLocaleString("en-IN")}`);
            doc.text(`4% Non-Refundable Fee Disclosure Included.`);
            doc.end();
        });
    }

    /**
     * Stream Invoice PDF to HTTP Response
     * @param {string} invoiceId 
     * @param {object} userOrAdmin 
     * @param {import("express").Response} res 
     */
    static async streamInvoicePdf(invoiceId, userOrAdmin, res) {
        const invoice = await InvoiceService.getInvoiceById(invoiceId, userOrAdmin);
        const pdfBuffer = await InvoicePdfService.generateInvoicePdfBuffer(invoiceId, userOrAdmin);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.end(pdfBuffer);
    }
}

export default InvoicePdfService;
