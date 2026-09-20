import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outputPath = 'C:\\Users\\USER\\Desktop\\Nod\\NOD_Platform_Complete_QA_Test_Flow.pdf';
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 50, left: 45, right: 45 },
  bufferPages: true,
  autoFirstPage: true
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Styling Palette
const PRIMARY = '#1E293B';    // Slate 800
const ACCENT = '#0284C7';     // Sky 600
const SECONDARY = '#475569';  // Slate 600
const BG_HEADER = '#0F172A';  // Slate 900
const LINE_COLOR = '#E2E8F0'; // Slate 200
const GREEN_STATUS = '#16A34A';
const AMBER_STATUS = '#D97706';

function drawHeaderBanner(title, subtitle = '') {
  doc.rect(45, doc.y, 505, 36).fill(PRIMARY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13)
     .text(title.toUpperCase(), 55, doc.y - 28, { width: 485 });
  if (subtitle) {
    doc.fillColor('#94A3B8').font('Helvetica-Oblique').fontSize(8.5)
       .text(subtitle, 55, doc.y + 1, { width: 485 });
  }
  doc.y += 16;
  doc.fillColor(PRIMARY);
}

function addSectionTitle(title) {
  doc.moveDown(0.8);
  if (doc.y > 670) doc.addPage();
  doc.rect(45, doc.y, 6, 20).fill(ACCENT);
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(13.5)
     .text(title, 58, doc.y + 3);
  doc.y += 8;
  doc.strokeColor(LINE_COLOR).lineWidth(1).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
}

function addSubSection(title) {
  if (doc.y > 690) doc.addPage();
  doc.moveDown(0.4);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10.5).text(title);
  doc.y += 4;
}

function addParagraph(text) {
  doc.fillColor(SECONDARY).font('Helvetica').fontSize(8.5).text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.3);
}

function addCalloutBox(title, text, type = 'info') {
  if (doc.y > 660) doc.addPage();
  const startY = doc.y;
  const boxWidth = 505;
  const borderColor = type === 'warn' ? AMBER_STATUS : (type === 'success' ? GREEN_STATUS : ACCENT);
  const bgColor = type === 'warn' ? '#FFFBEB' : (type === 'success' ? '#F0FDF4' : '#F0F9FF');

  doc.rect(45, startY, boxWidth, 42).fillAndStroke(bgColor, borderColor);
  doc.fillColor(borderColor).font('Helvetica-Bold').fontSize(8.5).text(title, 55, startY + 6);
  doc.fillColor(SECONDARY).font('Helvetica').fontSize(8).text(text, 55, startY + 20, { width: boxWidth - 20 });
  doc.y = startY + 48;
}

function addTestCaseTable(tcId, tcTitle, role, endpoint, preCond, steps, expected) {
  if (doc.y > 580) doc.addPage();
  const startY = doc.y;
  const tableWidth = 505;

  // Header Row
  doc.rect(45, startY, tableWidth, 19).fill('#1E293B');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
     .text(`${tcId}: ${tcTitle}`, 52, startY + 5, { width: 340 })
     .text(`Role: ${role}`, 400, startY + 5, { width: 140, align: 'right' });

  let curY = startY + 19;

  const rows = [
    { label: 'Target / Endpoint', val: endpoint, isCode: true },
    { label: 'Preconditions', val: preCond },
    { label: 'Test Steps', val: steps },
    { label: 'Expected Result', val: expected, isBold: true }
  ];

  rows.forEach((r, idx) => {
    const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    const textHeight = doc.heightOfString(r.val, { width: 380, font: r.isBold ? 'Helvetica-Bold' : (r.isCode ? 'Courier' : 'Helvetica'), size: 7.5 });
    const rowH = Math.max(20, textHeight + 9);

    if (curY + rowH > 770) {
      doc.addPage();
      curY = 45;
    }

    doc.rect(45, curY, tableWidth, rowH).fillAndStroke(bg, LINE_COLOR);
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(7.5)
       .text(r.label, 52, curY + 5, { width: 105 });

    doc.fillColor(r.isBold ? '#0F172A' : (r.isCode ? '#0369A1' : SECONDARY))
       .font(r.isBold ? 'Helvetica-Bold' : (r.isCode ? 'Courier' : 'Helvetica'))
       .fontSize(7.5)
       .text(r.val, 160, curY + 5, { width: 380, lineGap: 1.5 });

    curY += rowH;
  });

  doc.y = curY + 6;
}

// ==========================================
// 1. COVER PAGE
// ==========================================
doc.rect(0, 0, 595, 842).fill(BG_HEADER);
doc.rect(0, 0, 15, 842).fill(ACCENT);
doc.rect(45, 120, 80, 5).fill(ACCENT);

doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(26)
   .text('NIGHT OWLS DESIGN (NOD)', 45, 140);
doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(18)
   .text('COMPREHENSIVE QA TEST RUNBOOK & FLOW SPECIFICATION', 45, 172);

doc.fillColor('#94A3B8').font('Helvetica').fontSize(10.5)
   .text('Complete End-to-End Testing Manual Covering Frontend Web Application, Backend Microservices, Supabase Escrow Subsystem, and Admin Control Portal.', 45, 210, { width: 480, lineGap: 4 });

// Meta block
doc.rect(45, 290, 505, 165).fillAndStroke('#1E293B', '#334155');
doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(10.5).text('RELEASE & ENVIRONMENT SPECIFICATIONS', 60, 305);
doc.fillColor('#CBD5E1').font('Helvetica').fontSize(9)
   .text('Platform Version:    v1.0.0 (Production Candidate)', 60, 328)
   .text('Frontend URL:        https://night-owls-design.web.app', 60, 346)
   .text('Backend API Host:    https://api-3ftur77k3a-el.a.run.app/api', 60, 364)
   .text('Database Engine:     Supabase PostgreSQL 16 (ap-southeast-1 Pooler :6543)', 60, 382)
   .text('Security Protocols:  JWT Bearer Tokens, Cloudflare Turnstile CAPTCHA v3', 60, 400)
   .text('Financial & Mail:    Razorpay Smart Escrow Gateway & Gmail SMTP (nodindiaconnect@gmail.com)', 60, 418);

doc.rect(45, 480, 505, 190).fillAndStroke('#1E293B', '#334155');
doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(10.5).text('TARGET QA ROLES & RUNBOOK OBJECTIVES', 60, 495);
doc.fillColor('#CBD5E1').font('Helvetica').fontSize(8.5)
   .text('1. Frontend QA Engineers: Verify end-user workflows, responsive viewports, modals, and dynamic data loading without dummy fallbacks.', 60, 520, { width: 470 })
   .text('2. Backend & API Testers: Validate REST endpoints, JWT role guards (Roles 0-5), PostgreSQL connection pooler health, and CORS.', 60, 548, { width: 470 })
   .text('3. Fintech & Escrow Auditors: Audit multi-specialist bidding math, 50% initial deposit + 5% platform fee calculations, and milestone releases.', 60, 576, { width: 470 })
   .text('4. Admin Portal Mediators: Verify professional KYC approvals, milestone disputes, fund overrides, and bank payouts.', 60, 610, { width: 470 });

doc.fillColor('#64748B').font('Helvetica').fontSize(8.5)
   .text('Generated for NodIndia Connect QA Testing Team | Confidential Document | 2026', 45, 780, { align: 'center', width: 505 });

// ==========================================
// 2. TABLE OF CONTENTS
// ==========================================
doc.addPage();
drawHeaderBanner('Table of Contents', 'Comprehensive Flow Index');

const tocItems = [
  { num: 'Section 1', title: 'System Architecture, Role Matrix & Test Setup', page: '3' },
  { num: 'Section 2', title: 'Authentication, Registration & User Onboarding', page: '4' },
  { num: 'Section 3', title: 'Client End-to-End Workflow (Post Project -> Escrow -> Rating)', page: '6' },
  { num: 'Section 4', title: 'Professional Specialist Flow (Architect, Contractor, Designer)', page: '8' },
  { num: 'Section 5', title: 'Material Supplier Marketplace & Direct RFQ Flow', page: '10' },
  { num: 'Section 6', title: 'Admin Management Portal Runbook (Moderation & Escrow)', page: '11' },
  { num: 'Section 7', title: 'Backend REST API & Webhook Verification Matrix', page: '13' },
  { num: 'Section 8', title: 'Escrow State Machine, Financial Math & Edge Cases', page: '15' },
  { num: 'Section 9', title: 'Regression, Security, Performance & QA Sign-Off Checklist', page: '17' }
];

let tocY = doc.y + 10;
tocItems.forEach((item) => {
  doc.rect(45, tocY, 505, 24).fillAndStroke('#F8FAFC', LINE_COLOR);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text(item.num, 55, tocY + 7);
  doc.fillColor(PRIMARY).font('Helvetica').fontSize(8.5).text(item.title, 130, tocY + 7);
  doc.fillColor(SECONDARY).font('Helvetica-Bold').fontSize(8.5).text(`Page ${item.page}`, 475, tocY + 7, { align: 'right', width: 65 });
  tocY += 27;
});

doc.y = tocY + 15;
addCalloutBox(
  'HOW TESTERS SHOULD USE THIS RUNBOOK',
  'Execute test scenarios sequentially. Step-by-step instructions detail prerequisites, UI navigation paths, exact payloads, expected API responses, and database assertions. Mark checkbox passes and capture logs/screenshots for any failure.'
);

// ==========================================
// SECTION 1: ARCHITECTURE & ROLES
// ==========================================
doc.addPage();
addSectionTitle('1. System Architecture & Role Permission Matrix');

addParagraph('The NOD Platform connects property owners (Clients) with construction and interior design specialists (Architects, Contractors, Designers, Material Suppliers), governed by an Escrow mechanism and Super Admin mediation.');

addSubSection('1.1 Architecture Topology');
addParagraph('• Frontend Web App: React SPA hosted on Firebase Hosting (https://night-owls-design.web.app).\n• Backend Microservice: Node.js 22 + Express 5 running on Google Cloud Run (https://api-3ftur77k3a-el.a.run.app/api).\n• Database: Supabase PostgreSQL (Managed Postgres 16) connected through Prisma ORM via Singapore Transaction Pooler.\n• Bot Protection: Cloudflare Turnstile CAPTCHA v3 securing public lead capture.\n• Mailer: Nodemailer SMTP with Google App Password authentication (nodindiaconnect@gmail.com).\n• Payments: Razorpay Smart Gateway for Escrow deposit orders and automated signature verification.');

addSubSection('1.2 Platform Role Permission Matrix');

const roles = [
  { role: 'Role 0 / 7: Super Admin', access: 'Complete platform control: verify users, dispute resolution, milestone release overrides, finance auditing, withdrawal disbursements.' },
  { role: 'Role 1: Client', access: 'Post projects, review received proposals/bids, accept specialist bids, fund 50% deposit + 5% fee to escrow, review milestone proof, approve releases, submit reviews.' },
  { role: 'Role 2: Interior Designer', access: 'Build design portfolio, browse available projects, submit bidding proposals, execute design milestones, submit deliverables, request wallet payouts.' },
  { role: 'Role 3: Architect', access: 'Setup license & credentials, browse architectural tenders, bid on projects, submit 2D/3D blueprint milestones, receive escrow funds to wallet.' },
  { role: 'Role 4: Contractor', access: 'Setup civil/contractor profile, bid on civil construction scopes, execute on-site construction milestones, track milestone progress, wallet payouts.' },
  { role: 'Role 5: Material Supplier', access: 'List verified raw construction and interior materials, manage catalog prices, receive B2B supply inquiries, direct client quotes.' }
];

roles.forEach(r => {
  doc.rect(45, doc.y, 505, 27).fillAndStroke('#F8FAFC', LINE_COLOR);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8).text(r.role, 52, doc.y + 4);
  doc.fillColor(SECONDARY).font('Helvetica').fontSize(7.5).text(r.access, 52, doc.y + 14, { width: 490 });
  doc.y += 30;
});

// ==========================================
// SECTION 2: AUTH & REGISTRATION
// ==========================================
doc.addPage();
addSectionTitle('2. Authentication, Registration & Profile Onboarding Flows');

addParagraph('The authentication subsystem issues signed JWT Bearer tokens upon successful credential validation. Role guards enforce strict route authorization.');

addTestCaseTable(
  'TC-AUTH-01',
  'Client Self-Registration & Auto-Login',
  'Public Visitor / Client',
  'POST /api/auth/register',
  'User is on https://night-owls-design.web.app/register with valid new email.',
  '1. Select "I am a Homeowner / Client" role radio.\n2. Enter Name, Email, Password (min 8 chars), and Phone Number.\n3. Click "Create Account".',
  'Account created with Role=1. HTTP 201 returned with JWT token. User redirected to Client Dashboard (/client/dashboard). User profile avatar appears in header navbar.'
);

addTestCaseTable(
  'TC-AUTH-02',
  'Professional Specialist Registration (Architect / Contractor / Designer)',
  'Professional',
  'POST /api/auth/register',
  'User registers as Architect (Role 3), Contractor (Role 4), or Designer (Role 2).',
  '1. Select specialized professional role on registration page.\n2. Complete initial credentials.\n3. Complete Onboarding Profile Wizard: Experience years, license number, service cities, portfolio links, budget ranges.\n4. Submit profile for review.',
  'Record created in PostgreSQL with active=true, isVerified=false. Specialist dashboard displays "Pending Verification" badge until Admin approves license credentials.'
);

addTestCaseTable(
  'TC-AUTH-03',
  'User Login & JWT Token Refresh',
  'All Roles',
  'POST /api/auth/login',
  'Registered account exists with verified credentials.',
  '1. Navigate to /login.\n2. Enter registered email and password.\n3. Click Login.',
  'HTTP 200 returned containing user object and JWT bearer token. Token stored in localStorage. Role-based redirect triggered: Role 1->Client Portal, Role 2/3/4->Specialist Portal, Role 0->Admin Portal.'
);

addTestCaseTable(
  'TC-AUTH-04',
  'Public Lead Capture Popup with Cloudflare Turnstile & Email Notification',
  'Public Visitor',
  'POST /api/contact/leads/popup',
  'User browses landing page; popup opens after 5s or clicking "Get Free Quote".',
  '1. Fill Name, Phone (10 digits), Requirement description.\n2. Wait for Cloudflare Turnstile CAPTCHA to verify (green checkmark).\n3. Click "Submit Request".',
  'Lead record saved in PostgreSQL. Email notification sent instantly via Gmail SMTP to nodindiaconnect@gmail.com with lead details. Success toast displayed.'
);

// ==========================================
// SECTION 3: CLIENT END-TO-END JOURNEY
// ==========================================
doc.addPage();
addSectionTitle('3. Client End-to-End QA Journey: Project to Escrow & Rating');

addParagraph('The Client lifecycle encompasses project creation, proposal comparison, bid selection, multi-specialist escrow funding, deliverable inspection, milestone approval, and final contractor rating.');

addTestCaseTable(
  'TC-CLIENT-01',
  'Create New Construction / Renovation Project',
  'Client (Role 1)',
  'POST /api/client/projects',
  'Client is logged in. Valid project requirements prepared.',
  '1. Click "+ Post New Project" on Client Dashboard.\n2. Enter Title: "3BHK Luxury Interior & Renovation".\n3. Select Scope: "FULL_PROJECT", Categories: ["ARCHITECT", "INTERIOR_DESIGNER"].\n4. Enter Budget Min: 50000, Budget Max: 100000, City: Bangalore.\n5. Set Bidding Deadline (+7 days) and click Submit.',
  'Project created with status "WAITING_FOR_QUOTATIONS" and availability "OPEN". Project appears immediately on the public / available tenders list for specialists.'
);

addTestCaseTable(
  'TC-CLIENT-02',
  'Review Received Bids & Specialist Portfolios',
  'Client (Role 1)',
  'GET /api/bids/project/:projectId',
  'Multiple specialists (Architect & Designer) have submitted bids.',
  '1. Client navigates to Project Details page -> "Proposals" tab.\n2. Inspect bid amount, proposed timeline, portfolio link, and proposal message.\n3. Click specialist profile cards to view ratings and past completed projects.',
  'All submitted bids displayed with breakdown. Bid statuses show "PENDING". Client can compare prices and durations side-by-side.'
);

addTestCaseTable(
  'TC-CLIENT-03',
  'Accept Specialist Bids & Initialize Project Escrow',
  'Client (Role 1)',
  'POST /api/bids/:bidId/accept',
  'Client selects best bid for required services (e.g. Architect ₹30,000 + Designer ₹20,000 = ₹50,000).',
  '1. Click "Accept Proposal" on selected Architect bid.\n2. Click "Accept Proposal" on selected Designer bid.\n3. Click "Proceed to Contract Escrow".',
  'Project status moves to "ACCEPTED". Backend calculates Total Value (₹50,000), 50% Initial Escrow (₹25,000), and 5% Platform Fee (₹2,500). Non-selected bids updated to "REJECTED".'
);

addTestCaseTable(
  'TC-CLIENT-04',
  'Deposit Initial Escrow & Platform Fee (Razorpay)',
  'Client (Role 1)',
  'POST /api/payments/escrow/order & confirm',
  'Escrow order initialized in status "AWAITING_PAYMENT".',
  '1. Client clicks "Fund Escrow (50% Deposit + Platform Fee)".\n2. Razorpay checkout modal opens with exact amount (₹27,500).\n3. Complete payment in test mode (UPI / Card success).\n4. Wait for webhook & payment confirmation callback.',
  'Initial escrow payment confirmed. Escrow balance reflects ₹25,000 held safely. Platform fee marked paid. Project transitions to "IN_PROGRESS". Specialists receive notification to start Milestone 1.'
);

// ==========================================
// SECTION 4: SPECIALIST & MILESTONE EXECUTION
// ==========================================
doc.addPage();
addSectionTitle('4. Specialist Execution, Milestone Delivery & Escrow Release');

addParagraph('Specialists execute contracted work in predefined milestones. Escrow funds remain locked and protected until deliverables are reviewed and accepted by the client.');

addTestCaseTable(
  'TC-SPEC-01',
  'Browse Available Tenders & Submit Competitive Proposal',
  'Architect / Contractor / Designer',
  'POST /api/bids/create',
  'Specialist profile is verified. Project status is "WAITING_FOR_QUOTATIONS".',
  '1. Specialist navigates to "Browse Projects" marketplace.\n2. Filter by category (e.g. Villa Architecture) and location.\n3. Click "Submit Proposal".\n4. Enter Quoted Amount: ₹30,000, Proposed Duration: "20 Days", Proposal Message.\n5. Click "Submit Bid".',
  'Bid stored with status "PENDING". Specialist receives confirmation. Duplicate bids by same specialist on same project are rejected with 400 Bad Request.'
);

addTestCaseTable(
  'TC-SPEC-02',
  'Start Milestone & Upload Deliverable Proofs',
  'Specialist (Roles 2, 3, 4)',
  'POST /api/payments/milestone/:id/start & submit',
  'Bid accepted and 50% initial escrow funded by client. Milestone 1 is in "PENDING" status.',
  '1. Specialist navigates to Active Project Workspace.\n2. Click "Start Milestone 1 (Concept Elevation Blueprints)".\n3. Upon completion, upload deliverable blueprint PDF/image URLs.\n4. Enter completion remarks and click "Submit for Client Approval".',
  'Milestone status updates to "SUBMITTED". Client receives notification with links to review deliverable blueprints. Milestone timer records submission timestamp.'
);

addTestCaseTable(
  'TC-SPEC-03',
  'Client Request Revision vs. Client Instant Approval',
  'Client & Specialist',
  'POST /api/payments/milestone/:id/review',
  'Deliverable submitted by specialist.',
  'Scenario A (Revision): Client clicks "Request Revision" with remarks -> Milestone status changes to "REVISION_REQUESTED". Specialist re-uploads fixed drawings.\nScenario B (Approval): Client clicks "Approve Deliverable & Release Escrow".',
  'Upon Approval: Milestone marked "COMPLETED". Escrow service automatically transfers milestone funds from Escrow pool to Specialist Personal Wallet. Platform records transaction ledger entry.'
);

addTestCaseTable(
  'TC-SPEC-04',
  'Specialist Wallet Balance Audit & Bank Withdrawal Request',
  'Specialist (Roles 2, 3, 4)',
  'POST /api/wallet/withdraw',
  'Specialist has available wallet balance > ₹1,000 from released milestones.',
  '1. Specialist navigates to "My Earnings / Wallet".\n2. Verify Available Balance equals sum of approved milestones.\n3. Ensure Bank Details (Account No, IFSC, Account Holder Name) are linked.\n4. Enter Withdrawal Amount and click "Request Payout".',
  'Withdrawal record created with status "PENDING_ADMIN_APPROVAL". Available balance decreased by requested amount. Admin notified for disbursement.'
);

// ==========================================
// SECTION 5: MATERIAL SUPPLIER MARKETPLACE
// ==========================================
doc.addPage();
addSectionTitle('5. Material Supplier Marketplace & Catalog Inquiries');

addParagraph('The Supply Products portal provides a verified directory of building materials (cement, steel, plywood, tiles, sanitaryware, paints) with direct RFQ (Request for Quotation) workflows.');

addTestCaseTable(
  'TC-SUP-01',
  'Material Catalog Filtering & Search',
  'Public / Client / Contractor',
  'GET /api/materialSupplier/products',
  'User is on https://night-owls-design.web.app/supply-products.',
  '1. Verify supplier cards and products render live data from Supabase backend.\n2. Click category filter pills: "Plywood & Timber", "Steel & TMT", "Tiles & Flooring".\n3. Type keyword search: "UltraTech" or "Greenply".',
  'Product grid updates dynamically without page reload. If no products match query, verified empty state illustration displays ("No products found"). No static dummy data appears.'
);

addTestCaseTable(
  'TC-SUP-02',
  'Direct RFQ / Supply Inquiry Submission',
  'Client / Contractor',
  'POST /api/materialSupplier/inquiry',
  'User selects a supplier or product from the catalog.',
  '1. Click "Get Price Quote / Inquire" on selected supplier card.\n2. Enter required quantity (e.g. 500 Bags Cement, 50 Sheets Marine Ply).\n3. Enter site delivery address and contact phone number.\n4. Click "Send Inquiry".',
  'HTTP 201 created. Inquiry logged in backend database. Push/Email notification delivered to the supplier. Inquiry record visible in supplier dashboard.'
);

// ==========================================
// SECTION 6: ADMIN MANAGEMENT PORTAL
// ==========================================
doc.addPage();
addSectionTitle('6. Admin Management Portal Runbook (Moderation & Escrow)');

addParagraph('The Admin Portal (/admin) equips platform mediators and superusers with complete control over user credentials, project disputes, financial escrows, and bank disbursements.');

addTestCaseTable(
  'TC-ADM-01',
  'Professional Credential Verification & Approval',
  'Super Admin (Role 0/7)',
  'PATCH /api/admin/users/:id/verify',
  'New Architect / Contractor has registered and uploaded professional council license.',
  '1. Log into Admin Portal with admin credentials.\n2. Navigate to "User Management" -> "Specialists Pending Verification".\n3. Click "Inspect Documents" to view license number and portfolio.\n4. Click "Approve & Verify Specialist".',
  'User status updated to isVerified=true in PostgreSQL. Specialist receives verification confirmation email and their profile displays "Verified Pro" badge on client search.'
);

addTestCaseTable(
  'TC-ADM-02',
  'Escrow Pool Inspection & Transaction Audit Ledger',
  'Super Admin (Role 0/7)',
  'GET /api/admin/finance/escrow-summary',
  'Active projects with funded escrows exist in system.',
  '1. Navigate to "Finance & Escrow Ledger".\n2. Inspect Total Escrow Held across all active projects.\n3. Inspect Total Platform Fees Collected (5% cut).\n4. View per-project transaction ledger (Deposits, Releases, Refunds).',
  'Ledger mathematically balances: Total Held + Total Released + Total Refunded == Gross Gateway Deposits. No discrepancy allowed.'
);

addTestCaseTable(
  'TC-ADM-03',
  'Project Milestone Dispute Mediation & Force Release / Refund',
  'Super Admin (Role 0/7)',
  'POST /api/admin/projects/:id/dispute/resolve',
  'Client and Specialist have raised a dispute over milestone deliverables.',
  '1. Navigate to "Dispute Center" -> Select disputed project.\n2. Inspect communication log, submitted proof files, and revision history.\n3. Mediator options: A) Force Release to Specialist, B) Refund Milestone to Client, C) Split 50/50.\n4. Enter legal mediation notes and confirm.',
  'Escrow state machine executes the selected resolution. Milestone updated to "RESOLVED". Wallets updated instantaneously. Both parties notified.'
);

addTestCaseTable(
  'TC-ADM-04',
  'Process Specialist Bank Withdrawal & Payout Disbursement',
  'Super Admin (Role 0/7)',
  'PATCH /api/admin/finance/withdrawals/:id/disburse',
  'Specialist has submitted a withdrawal request in status "PENDING_ADMIN_APPROVAL".',
  '1. Navigate to "Withdrawal Requests".\n2. Verify Specialist Bank Account Number, Bank Name, and IFSC Code.\n3. Execute payout via banking rail / IMPS / NEFT.\n4. Enter Bank UTR / Reference Transaction ID.\n5. Click "Mark Disbursed".',
  'Withdrawal status updated to "COMPLETED". Specialist wallet record locked. Email notification dispatched with UTR tracking reference.'
);

// ==========================================
// SECTION 7: API & WEBHOOK TEST MATRIX
// ==========================================
doc.addPage();
addSectionTitle('7. Backend REST API & Webhook Verification Matrix');

addParagraph('Automated testers must verify status codes, CORS headers, authentication guards, and response schemas across all endpoints:');

const apiEndpoints = [
  { method: 'POST', path: '/api/auth/login', desc: 'Validates email/password, returns JWT token and role payload', auth: 'Public', status: '200 / 401' },
  { method: 'POST', path: '/api/contact/leads/popup', desc: 'Cloudflare Turnstile token validation + Lead DB write + Gmail SMTP', auth: 'Public', status: '201 / 400' },
  { method: 'GET',  path: '/api/portfolio/all', desc: 'Fetches published architectural & interior design project portfolios', auth: 'Public', status: '200' },
  { method: 'POST', path: '/api/client/projects', desc: 'Creates new construction/renovation project tender', auth: 'Role 1 (Client)', status: '201 / 400' },
  { method: 'POST', path: '/api/bids/create', desc: 'Specialist submits quotation price, duration, and proposal', auth: 'Roles 2,3,4', status: '201 / 400' },
  { method: 'POST', path: '/api/bids/:id/accept', desc: 'Client accepts specialist proposal; initializes escrow record', auth: 'Role 1 (Client)', status: '200 / 403' },
  { method: 'POST', path: '/api/payments/escrow/order', desc: 'Generates Razorpay order for 50% deposit + 5% platform fee', auth: 'Role 1 (Client)', status: '200 / 400' },
  { method: 'POST', path: '/api/webhooks/payments/razorpay', desc: 'HMAC SHA256 webhook for autonomous payment confirmation', auth: 'Webhook Sig', status: '200 / 400' },
  { method: 'POST', path: '/api/payments/milestone/:id/start', desc: 'Specialist officially begins work on contracted milestone', auth: 'Assigned Pro', status: '200 / 403' },
  { method: 'POST', path: '/api/payments/milestone/:id/submit', desc: 'Uploads deliverable proof URLs and notes for review', auth: 'Assigned Pro', status: '200 / 400' },
  { method: 'POST', path: '/api/payments/milestone/:id/review', desc: 'Client approves deliverable; triggers escrow funds transfer to wallet', auth: 'Role 1 (Client)', status: '200 / 400' },
  { method: 'GET',  path: '/api/wallet/my-wallet', desc: 'Returns specialist wallet ledger: available, locked, withdrawn', auth: 'Roles 2,3,4,5', status: '200' },
  { method: 'POST', path: '/api/wallet/withdraw', desc: 'Submits bank withdrawal request for earned funds', auth: 'Roles 2,3,4,5', status: '201 / 400' },
  { method: 'GET',  path: '/api/admin/dashboard/metrics', desc: 'Returns platform-wide KPIs: GMV, Escrow locked, Active projects', auth: 'Role 0 (Admin)', status: '200 / 403' }
];

apiEndpoints.forEach(ep => {
  if (doc.y > 750) doc.addPage();
  doc.rect(45, doc.y, 505, 25).fillAndStroke('#F8FAFC', LINE_COLOR);
  
  const badgeColor = ep.method === 'GET' ? '#0284C7' : (ep.method === 'POST' ? '#16A34A' : '#D97706');
  doc.rect(50, doc.y + 4, 38, 15).fill(badgeColor);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5).text(ep.method, 50, doc.y + 7, { width: 38, align: 'center' });

  doc.fillColor(PRIMARY).font('Courier-Bold').fontSize(8).text(ep.path, 95, doc.y + 6, { width: 230 });
  doc.fillColor(SECONDARY).font('Helvetica').fontSize(7.5).text(ep.desc, 330, doc.y + 3, { width: 150 });
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.5).text(ep.status, 485, doc.y + 6, { width: 60, align: 'right' });
  doc.y += 28;
});

// ==========================================
// SECTION 8: ESCROW FINANCIAL MATH & EDGE CASES
// ==========================================
doc.addPage();
addSectionTitle('8. Escrow State Machine, Financial Math & Edge Cases');

addParagraph('The escrow system enforces strict mathematical consistency. Testers must verify that no funds are released prematurely and that the platform fee formula is always exact.');

addSubSection('8.1 Financial Calculations Spec');
addParagraph('Given Accepted Specialist Quotations summing to Total Value (V):\n• Total Project Value = Sum of all accepted specialist bids.\n• Initial Deposit Required = 50% of Total Project Value (0.50 * V).\n• Platform Fee = Exactly 5% of Total Project Value (0.05 * V).\n• Initial Gateway Order Amount = Initial Deposit + Platform Fee = (0.55 * V).\n• Milestone Payout Sum = Exactly 100% of specialist bids upon final completion.');

addCalloutBox(
  'SECURITY CHECK: ZERO PREMATURE WALLET RELEASE',
  'When the client funds the initial 50% deposit, specialist personal wallets MUST REMAIN ₹0.00. Funds reside strictly in the project escrow pool. Wallets are ONLY incremented when a milestone deliverable is approved by the client or admin mediator.',
  'warn'
);

addSubSection('8.2 Critical Edge Cases for QA Testers to Break');
const edgeCases = [
  'EC-01 (Double Bidding): Specialist attempts to submit two bids on the same project -> Expect 400 Bad Request.',
  'EC-02 (Expired Deadline): Specialist attempts to submit bid after biddingDeadline timestamp -> Expect 400 Bid Closed.',
  'EC-03 (Unauthorized Milestone Approval): Specialist attempts to approve their own milestone -> Expect 403 Forbidden.',
  'EC-04 (Negative Withdrawal): User attempts to withdraw ₹-500 or amount > available wallet balance -> Expect 400 Insufficient Funds.',
  'EC-05 (Invalid Bank IFSC): Withdrawal request with invalid IFSC format -> Expect validation error.',
  'EC-06 (Razorpay Tampered Webhook): Webhook payload with forged HMAC signature -> Expect 400 Invalid Signature.',
  'EC-07 (CORS Isolation): Requests from unauthorized domains -> Cross-Origin Resource Policy allows only authorized frontend origins.'
];

edgeCases.forEach(ec => {
  doc.rect(45, doc.y, 505, 21).fillAndStroke('#FFFFFF', LINE_COLOR);
  doc.fillColor(SECONDARY).font('Helvetica').fontSize(8).text(ec, 52, doc.y + 5, { width: 490 });
  doc.y += 23;
});

// ==========================================
// SECTION 9: QA SIGN-OFF CHECKLIST
// ==========================================
doc.addPage();
addSectionTitle('9. Regression, Smoke & QA Sign-Off Checklist');

addParagraph('All testers must execute and sign off on the following criteria prior to production promotion:');

const checklist = [
  { cat: 'Smoke', item: 'Public landing page loads in < 1.5s with zero console errors or broken asset links.' },
  { cat: 'Security', item: 'Cloudflare Turnstile prevents bot submissions on lead capture popup.' },
  { cat: 'Mailer', item: 'Gmail SMTP successfully dispatches lead notifications to nodindiaconnect@gmail.com.' },
  { cat: 'Data', item: 'Supply products page displays live Supabase data; no dummy fallback data visible.' },
  { cat: 'Escrow', item: 'Initial 50% deposit + 5% platform fee calculation matches Razorpay checkout amount exactly.' },
  { cat: 'Escrow', item: 'Milestone approval immediately credits specialist wallet balance without race conditions.' },
  { cat: 'Dispute', item: 'Admin dispute override correctly refunds or releases locked escrow funds.' },
  { cat: 'Payout', item: 'Withdrawal requests deduct available balance and log auditable bank UTR reference.' },
  { cat: 'Mobile', item: 'Responsive navigation, project creation forms, and bidding modals work seamlessly on iOS & Android.' }
];

checklist.forEach((chk, i) => {
  doc.rect(45, doc.y, 505, 24).fillAndStroke(i % 2 === 0 ? '#F8FAFC' : '#FFFFFF', LINE_COLOR);
  doc.rect(52, doc.y + 6, 12, 12).stroke('#94A3B8');
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8).text(`[ ${chk.cat} ]`, 72, doc.y + 7);
  doc.fillColor(PRIMARY).font('Helvetica').fontSize(8).text(chk.item, 140, doc.y + 7, { width: 400 });
  doc.y += 26;
});

doc.moveDown(1);
doc.rect(45, doc.y, 505, 75).fillAndStroke('#F1F5F9', '#CBD5E1');
doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9).text('QA EXECUTION SIGN-OFF', 55, doc.y + 8);
doc.fillColor(SECONDARY).font('Helvetica').fontSize(8.5)
   .text('Lead QA Engineer: _______________________      Date: _______________      Status:  [  ] PASS   [  ] FAIL', 55, doc.y + 26)
   .text('Engineering Lead:  _______________________      Date: _______________      Deployment Build: v1.0.0-PROD', 55, doc.y + 46);

// ==========================================
// FOOTERS (Page Numbers)
// ==========================================
const pageCount = doc.bufferedPageRange().count;
for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  if (i > 0) { // skip cover page
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8)
       .text('Night Owls Design (NOD) — Comprehensive Platform QA Test Runbook', 45, 805, { width: 350 });
    doc.fillColor('#94A3B8').font('Helvetica-Bold').fontSize(8)
       .text(`Page ${i + 1} of ${pageCount}`, 400, 805, { width: 150, align: 'right' });
    doc.strokeColor(LINE_COLOR).lineWidth(0.5).moveTo(45, 800).lineTo(550, 800).stroke();
  }
}

doc.end();

writeStream.on('finish', () => {
  console.log(`✓ PDF successfully generated at: ${outputPath}`);
  console.log(`✓ Total Pages: ${pageCount}`);
});
