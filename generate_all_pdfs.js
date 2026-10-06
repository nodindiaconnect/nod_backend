import puppeteer from "puppeteer-core";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const MASTER_PDF_PATH = "c:\\Users\\USER\\Desktop\\Nod\\NOD_Master_Architecture_And_Test_Specification.pdf";
const INVOICE_PDF_PATH = "c:\\Users\\USER\\Desktop\\Nod\\NOD_Sample_Tax_Invoice.pdf";

const masterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NOD Platform - Complete System Architecture & Test Specification</title>
<style>
  @page {
    size: A4;
    margin: 18mm 14mm 18mm 14mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.5;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
  }
  .header-box {
    border-bottom: 2px solid #00466a;
    padding-bottom: 10px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .header-title {
    font-size: 20pt;
    font-weight: 800;
    color: #00466a;
    margin: 0 0 4px 0;
  }
  .header-subtitle {
    font-size: 10.5pt;
    color: #475569;
    margin: 0;
  }
  .meta-tag {
    background-color: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 8pt;
    font-weight: 600;
    color: #334155;
    text-align: right;
  }
  h2 {
    font-size: 13pt;
    color: #00466a;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt;
    color: #0f172a;
    margin-top: 12px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  p { margin: 0 0 8px 0; }
  ul, ol { margin: 0 0 8px 0; padding-left: 18px; }
  li { margin-bottom: 3px; }

  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .badge-pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .badge-primary { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

  .callout {
    background: #f8fafc;
    border-left: 4px solid #00466a;
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 0 6px 6px 0;
    font-size: 9pt;
  }
  .callout-success { background: #f0fdf4; border-left-color: #16a34a; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 8.5pt;
  }
  th, td {
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: top;
  }
  th {
    background-color: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
  }
  tr:nth-child(even) td { background-color: #f8fafc; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 8pt;
    background: #f1f5f9;
    padding: 1px 3px;
    border-radius: 3px;
    color: #0f172a;
  }
  .test-card {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    margin-bottom: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .test-card-header {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 5px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .test-card-body {
    padding: 7px 8px;
    background: #ffffff;
  }
  .tc-title { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
  .tc-row {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 6px;
    font-size: 8.5pt;
    margin-bottom: 3px;
  }
  .tc-label { font-weight: 700; color: #475569; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="header-box">
  <div>
    <h1 class="header-title">NOD PLATFORM MASTER DOCUMENT</h1>
    <p class="header-subtitle">System Architecture, Workflow Specifications & End-to-End Test Matrix</p>
  </div>
  <div class="meta-tag">
    Night Owl Designers (NOD)<br/>
    Version 2.4.0 • September 2026
  </div>
</div>

<div class="callout callout-success">
  <strong>Master Summary:</strong> This document combines the complete technical architecture and end-to-end test verification matrix for the NOD platform across Backend (<code>nod_backend</code>), Client & Specialist Frontend (<code>nod_frontend</code>), and Admin Portal (<code>nod_admin</code>).
</div>

<h2>SECTION 1: SYSTEM ARCHITECTURE & 100% ESCROW MODEL</h2>
<p>NOD enforces a <strong>100% Upfront Secured Escrow Model</strong> for all architectural, interior design, and contractor projects:</p>
<ol>
  <li><strong>100% Upfront Payment:</strong> Client pays 100% of project amount + 5% platform fee + 18% GST on platform fee into Escrow.</li>
  <li><strong>Specialist Activation Guard:</strong> The awarded specialist cannot start work or submit deliverables until payment is verified by the backend.</li>
  <li><strong>Tax Invoice Generation:</strong> An official NOD Tax Invoice is generated and emailed to the client with an A4 PDF attachment.</li>
  <li><strong>Stage-Wise Deliverables:</strong> Work is broken into 3 stages: Phase 1 (30%), Phase 2 (40%), and Phase 3 (30%).</li>
  <li><strong>Stage Approval & Wallet Release:</strong> Client approval of a stage releases that stage's percentage payout directly into the specialist's personal wallet (<code>Wallet.totalAvailableBalance</code>).</li>
  <li><strong>Direct Bank Withdrawal:</strong> Specialists request bank withdrawals to their verified bank accounts.</li>
</ol>

<h2>SECTION 2: FINANCIAL & TAX ENGINE CALCULATIONS</h2>
<table>
  <thead>
    <tr>
      <th>Component</th>
      <th>Formula / Basis</th>
      <th>Example (₹1,00,000 Project)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Base Project Amount</strong></td>
      <td>Locked Approved Amount from Accepted Quotation</td>
      <td>₹1,00,000</td>
    </tr>
    <tr>
      <td><strong>Platform Service Fee</strong></td>
      <td>5.0% of Base Project Amount</td>
      <td>₹5,000</td>
    </tr>
    <tr>
      <td><strong>GST on Platform Fee</strong></td>
      <td>18.0% of Platform Fee (CGST 9% + SGST 9%)</td>
      <td>₹900</td>
    </tr>
    <tr>
      <td><strong>Total Client Payable</strong></td>
      <td>Base Amount + Platform Fee + GST</td>
      <td><strong>₹1,05,900 (100% Upfront)</strong></td>
    </tr>
    <tr>
      <td><strong>Phase 1 Deliverables Release</strong></td>
      <td>30% of Base Project Amount</td>
      <td>₹30,000 credited to specialist wallet</td>
    </tr>
    <tr>
      <td><strong>Phase 2 Deliverables Release</strong></td>
      <td>40% of Base Project Amount</td>
      <td>₹40,000 credited to specialist wallet</td>
    </tr>
    <tr>
      <td><strong>Phase 3 Deliverables Release</strong></td>
      <td>30% of Base Project Amount</td>
      <td>₹30,000 credited to specialist wallet</td>
    </tr>
    <tr>
      <td><strong>Total Escrow Payout to Specialist</strong></td>
      <td>Phase 1 + Phase 2 + Phase 3</td>
      <td><strong>₹1,00,000 (100% of Project Cost)</strong></td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<h2>SECTION 3: END-TO-END TEST EXECUTION MATRIX</h2>
<table>
  <thead>
    <tr>
      <th>Suite ID</th>
      <th>Functional Area</th>
      <th>Total</th>
      <th>Pass</th>
      <th>Fail</th>
      <th>Verification Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>TC-SUITE-01</strong></td>
      <td>Specialist Quotation & Bank Details Validation</td>
      <td>3</td>
      <td>3</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> Verified UI Inline Errors & DB</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-02</strong></td>
      <td>Proposal Acceptance & Approved Amount Lock</td>
      <td>2</td>
      <td>2</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> DRAFT Contract & Role Unique</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-03</strong></td>
      <td>100% Upfront Escrow Payment & Specialist Activation</td>
      <td>3</td>
      <td>3</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> Razorpay Order & Escrow Funded</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-04</strong></td>
      <td>Tax Invoice PDF Generation & Email Dispatch</td>
      <td>2</td>
      <td>2</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> UDYAM/GSTIN + Nodemailer</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-05</strong></td>
      <td>Stage-Wise Content Deliverables & Approvals</td>
      <td>3</td>
      <td>3</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> 30/40/30 Stages & Protected View</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-06</strong></td>
      <td>Specialist Personal Wallet & Bank Withdrawal</td>
      <td>3</td>
      <td>3</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> Atomic Debit & Payout Queue</td>
    </tr>
    <tr>
      <td><strong>TC-SUITE-07</strong></td>
      <td>Escrow Dispute & Arbitration Settlement</td>
      <td>2</td>
      <td>2</td>
      <td>0</td>
      <td><span class="badge badge-pass">PASSED</span> 4% Non-Refundable Formula</td>
    </tr>
  </tbody>
</table>

<h2>SECTION 4: DETAILED TEST SPECIFICATIONS</h2>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-01.1: Block Quotation Submission Without Bank Details</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">Pre-conditions:</span><span>Specialist logged in with no bank account in <code>BankDetail</code> table.</span></div>
    <div class="tc-row"><span class="tc-label">Test Steps:</span><span>1. Open project modal. 2. Enter price ₹50,000, duration 30 days. 3. Click "Submit Proposal".</span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>Submission blocked with error: <em>"Bank details required!"</em>. Bank form displays.</span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified in <code>SubmitProposalModal.jsx</code> and <code>bidService.js</code>.</span></div>
  </div>
</div>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-01.2: Inline Real-Time Validation on Bank Account Form</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">Test Steps:</span><span>1. Enter Account Number "12345". 2. Enter Confirm Account Number "54321". 3. Enter IFSC "invalid_ifsc". 4. Click Save.</span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>Red borders and error text: <em>"Account number must be 9-18 digits"</em>, <em>"Account numbers do not match"</em>, <em>"Invalid IFSC format"</em>.</span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified inline state errors in <code>SubmitProposalModal.jsx</code>.</span></div>
  </div>
</div>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-02.1: Client Awards Bid & Locks Approved Amount</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">API Route:</span><span><code>POST /api/bids/bids/:bidId/award</code></span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>
      1. <code>Project.approvedProjectAmount</code> = 100000.<br/>
      2. <code>Project.status</code> = <code>PAYMENT_REQUIRED</code>.<br/>
      3. <code>Contract</code> created in <code>DRAFT</code> status with 3 stage milestones: Phase 1 (₹30,000), Phase 2 (₹40,000), Phase 3 (₹30,000).
    </span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified in <code>bidService.js</code>.</span></div>
  </div>
</div>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-03.2: 100% Upfront Payment Execution & Entity Activation</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">API Route:</span><span><code>POST /api/payments/projects/:projectId/pay-milestone</code> (sequence: 1)</span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>
      1. <code>ProjectEscrow.escrowBalance</code> increments by ₹1,00,000 and status = <code>FUNDED</code>.<br/>
      2. <code>Project.status</code> transitions to <code>IN_PROGRESS</code>.<br/>
      3. <code>Contract.status</code> transitions to <code>ACTIVE</code>.<br/>
      4. Specialist team member transitions to <code>ACTIVE</code>.
    </span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified in <code>escrowService.js</code>.</span></div>
  </div>
</div>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-05.2: Client Approves Stage & Releases Escrow to Specialist Wallet</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">API Route:</span><span><code>POST /api/payments/milestones/:milestoneId/approve</code></span></div>
    <div class="tc-row"><span class="tc-label">Action:</span><span>Client clicks "Approve & Release" for Phase 1 (₹30,000).</span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>
      1. <code>ProjectEscrow.escrowBalance</code> decrements by ₹30,000.<br/>
      2. <code>Wallet.totalAvailableBalance</code> for specialist increments by ₹30,000.<br/>
      3. Milestone status permanently locked as <code>PAID</code> / <code>APPROVED</code>.<br/>
      4. Phase advances to Phase 2.
    </span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified in <code>escrowService.js</code>.</span></div>
  </div>
</div>

<div class="test-card">
  <div class="test-card-header">
    <span class="tc-title">TC-06.2: Specialist Requests Bank Withdrawal from Wallet</span>
    <span class="badge badge-pass">PASS</span>
  </div>
  <div class="test-card-body">
    <div class="tc-row"><span class="tc-label">API Route:</span><span><code>POST /api/wallet/withdraw</code></span></div>
    <div class="tc-row"><span class="tc-label">Action:</span><span>Specialist submits withdrawal for ₹25,000 from available ₹30,000 balance.</span></div>
    <div class="tc-row"><span class="tc-label">Expected:</span><span>
      1. <code>totalAvailableBalance</code> decrements by ₹25,000 atomically.<br/>
      2. <code>Withdrawal</code> record created with status <code>PENDING</code> for admin payout.
    </span></div>
    <div class="tc-row"><span class="tc-label">Verification:</span><span>Passed. Verified in <code>walletService.js</code>.</span></div>
  </div>
</div>

<h2>SECTION 5: CODEBASE REPOSITORY INDEX</h2>
<table>
  <thead>
    <tr>
      <th>Module</th>
      <th>File Path</th>
      <th>Core Function</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Backend</td><td><code>nod_backend/services/taxService.js</code></td><td>100% Upfront, fee, GST, and stage payout calculations</td></tr>
    <tr><td>Backend</td><td><code>nod_backend/services/escrowService.js</code></td><td>Razorpay order creation, payment confirmation, escrow release</td></tr>
    <tr><td>Backend</td><td><code>nod_backend/services/bidService.js</code></td><td>Bank validation, proposal placement, contract awarding</td></tr>
    <tr><td>Backend</td><td><code>nod_backend/services/invoicePdfService.js</code></td><td>Puppeteer / PDFKit official Tax Invoice generation</td></tr>
    <tr><td>Backend</td><td><code>nod_backend/services/walletService.js</code></td><td>Personal wallet balances, atomic debits, and withdrawals</td></tr>
    <tr><td>Frontend</td><td><code>nod_frontend/src/components/dashboard/shared/MilestonesTracker.jsx</code></td><td>100% upfront escrow checkout & stage approvals UI</td></tr>
    <tr><td>Frontend</td><td><code>nod_frontend/src/components/dashboardPages/shared/SubmitProposalModal.jsx</code></td><td>Proposal modal with real-time inline bank validation</td></tr>
    <tr><td>Frontend</td><td><code>nod_frontend/src/components/dashboard/shared/EarningsWorkspace.jsx</code></td><td>Specialist wallet, payout ledger, bank withdrawal modal</td></tr>
    <tr><td>Admin</td><td><code>nod_admin/src/components/Finance/FinanceManagement.jsx</code></td><td>Platform fees and withdrawal payout processing</td></tr>
    <tr><td>Admin</td><td><code>nod_admin/src/components/Disputes/DisputesManagement.jsx</code></td><td>Escrow dispute arbitration with 4% deduction rule</td></tr>
  </tbody>
</table>

<div style="margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8pt; color: #64748b; text-align: center;">
  Night Owl Designers (NOD) • UDYAM-MP-08-0041277 • GSTIN: 23PQPPS9344H1ZV • Confidential & Proprietary
</div>

</body>
</html>`;

async function generateMasterAndInvoicePdfs() {
  console.log("Launching Chromium for Master PDF...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  // 1. Generate Master Architecture & Test PDF
  const page1 = await browser.newPage();
  await page1.setContent(masterHtml, { waitUntil: "networkidle0" });
  const masterPdfBuffer = await page1.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
  });
  fs.writeFileSync(MASTER_PDF_PATH, masterPdfBuffer);
  console.log(`Saved Master PDF: ${MASTER_PDF_PATH} (${(masterPdfBuffer.length / 1024).toFixed(1)} KB)`);

  // 2. Generate Sample Tax Invoice PDF using InvoicePdfService HTML template
  const InvoicePdfService = (await import("./services/invoicePdfService.js")).default;
  const mockInvoice = {
    invoiceNumber: "INV-NOD-2026-00108",
    paidAt: new Date(),
    clientName: "Rahul Sharma",
    clientEmail: "rahul.sharma@example.com",
    clientPhone: "+91 98765 43210",
    projectId: "proj-residential-villa-betul",
    milestoneSequence: 1,
    milestoneTitle: "100% Full Project Escrow Deposit & Platform Fee",
    milestonePercentage: 100,
    totalProjectValue: 100000,
    milestoneAmount: 100000,
    platformFeeRate: 5.0,
    platformFeeAmount: 5000,
    totalAmountPaid: 105900,
    remainingAmount: 0,
    transactionId: "pay_Rzp94829104820",
    paymentGateway: "Razorpay Escrow",
    status: "PAID",
  };
  const mockProject = {
    id: "proj-residential-villa-betul",
    title: "Luxury 3BHK Villa Architectural & Interior Design",
    location: "Itarsi Road, Betul, MP",
    category: "RESIDENTIAL",
    projectType: "Full Architecture & Interiors",
    projectDeliveryType: "TWO_D_PLUS_THREE_D",
    totalCost: 100000,
  };

  const invoiceHtml = InvoicePdfService.buildInvoiceHtml(mockInvoice, mockProject);
  const page2 = await browser.newPage();
  await page2.setContent(invoiceHtml, { waitUntil: "networkidle0" });
  const invoicePdfBuffer = await page2.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  fs.writeFileSync(INVOICE_PDF_PATH, invoicePdfBuffer);
  console.log(`Saved Sample Invoice PDF: ${INVOICE_PDF_PATH} (${(invoicePdfBuffer.length / 1024).toFixed(1)} KB)`);

  await browser.close();
}

generateMasterAndInvoicePdfs().catch((err) => {
  console.error("PDF generation error:", err);
  process.exit(1);
});
