import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

async function generatePdf() {
    const outputDir = "C:/Users/USER/Desktop/Nod";
    const brainDir = "C:/Users/USER/.gemini/antigravity/brain/310e96b0-4d58-42ea-b179-17e4e1645971";
    
    const outputFile = path.join(outputDir, "Next_Phase_Money_Distribution_Recommendations.pdf");
    const brainPdfFile = path.join(brainDir, "Next_Phase_Money_Distribution_Recommendations.pdf");

    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
    });

    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);

    // Color Palette
    const goldColor = "#A67C1E";
    const primaryDark = "#111827";
    const mutedGray = "#4B5563";
    const lightBg = "#F9FAFB";
    const borderGray = "#E5E7EB";
    const emeraldGreen = "#047857";

    // --- Header Branding ---
    doc.rect(45, 35, 505, 55).fillAndStroke(lightBg, borderGray);
    
    doc.fillColor(goldColor).fontSize(16).font("Helvetica-Bold").text("NIGHT OWL DESIGNERS", 60, 48);
    doc.fillColor(primaryDark).fontSize(9).font("Helvetica").text("ARCHITECTURE, INTERIOR DESIGN & CONSTRUCTION ECOSYSTEM", 60, 68);

    doc.fillColor(mutedGray).fontSize(8).font("Helvetica").text("CONFIDENTIAL DESIGN DOCUMENT", 340, 48, { align: "right" });
    doc.fillColor(mutedGray).fontSize(8).font("Helvetica").text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 340, 64, { align: "right" });

    doc.moveDown(3);

    // --- Document Title ---
    doc.fillColor(primaryDark).fontSize(18).font("Helvetica-Bold").text("Next Phase Implementation Recommendations: Money Distribution & Milestone Payout Architecture");
    doc.moveDown(0.5);
    doc.fillColor(goldColor).fontSize(11).font("Helvetica-Bold").text("Role-Phased, Contract-Linked & Escrow-Protected Disbursement Model");
    doc.moveDown(1);

    // Divider
    doc.strokeColor(goldColor).lineWidth(1.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // --- Section 1: Executive Overview ---
    doc.fillColor(primaryDark).fontSize(13).font("Helvetica-Bold").text("1. Executive Overview & Problem Statement");
    doc.moveDown(0.4);
    doc.fillColor(mutedGray).fontSize(9.5).font("Helvetica").lineGap(3).text(
        "In modern architectural and construction turnkey projects, assigned service providers (Architects, Interior Designers, Contractors, and Material Suppliers) do not work on uniform schedules or share equal financial weight. Therefore, an equal split (1/N) of client milestone payments is strictly unviable.\n\n" +
        "The Money Distribution Engine must adhere to a Role-Aware, Contract-Weighted, and Milestone-Linked matrix where each specialist's payout is unlocked based on verified deliverables and their contractual scope."
    );
    doc.moveDown(1);

    // --- Section 2: Core Distribution Principles ---
    doc.fillColor(primaryDark).fontSize(13).font("Helvetica-Bold").text("2. Core Distribution Principles & Mathematical Model");
    doc.moveDown(0.4);
    doc.fillColor(mutedGray).fontSize(9.5).font("Helvetica").lineGap(2.5).text(
        "• Single Source of Truth: Total Project Value (V) = Sum of all awarded specialist contracts.\n" +
        "• Platform Fee Isolation: The dynamic Platform Fee (P%) is collected for platform revenue and is never deducted from specialist earnings.\n" +
        "• Escrow-First Staging: Client payments (50% Advance, 25% Second, 25% Final) are collected 100% into the dedicated Project Escrow Account before any specialist disbursement occurs.\n" +
        "• Independent Verification: Payout to Specialist A is released upon their milestone deliverable sign-off, without being blocked by Specialist B unless strict structural dependencies exist."
    );
    doc.moveDown(1);

    // --- Section 3: Scenario Breakdown ---
    doc.fillColor(primaryDark).fontSize(13).font("Helvetica-Bold").text("3. Milestone Payout Matrix Across Team Combinations");
    doc.moveDown(0.5);

    // Scenario A
    doc.fillColor(primaryDark).fontSize(10.5).font("Helvetica-Bold").text("Scenario A: Single Specialist (e.g. Architect Only)");
    doc.fillColor(mutedGray).fontSize(9).font("Helvetica").lineGap(2).text(
        "• Milestone 1 (50% Advance): 50% release upon site analysis, zoning compliance, and conceptual floor plan sign-off.\n" +
        "• Milestone 2 (25% Second Payment): 25% release upon structural drawings and municipal permit filing.\n" +
        "• Milestone 3 (25% Final Payment): 25% release upon final working blueprints and completion handover."
    );
    doc.moveDown(0.8);

    // Scenario B
    doc.fillColor(primaryDark).fontSize(10.5).font("Helvetica-Bold").text("Scenario B: Architect + Interior Designer");
    doc.fillColor(mutedGray).fontSize(9).font("Helvetica").lineGap(2).text(
        "• Distribution Formula: Proportional to individual contract values (e.g. 60% Architect, 40% Designer).\n" +
        "• Milestone 1 (50% Advance): 50% of Architect Contract + 50% of Designer Contract released upon initial concept & moodboards.\n" +
        "• Milestone 2 (25% Second): 25% released upon detailed 2D/3D elevations, MEP plans, and material specifications.\n" +
        "• Milestone 3 (25% Final): 25% released upon full joinery details, styling schedules, and final vendor handover."
    );
    doc.moveDown(0.8);

    // Scenario C
    doc.fillColor(primaryDark).fontSize(10.5).font("Helvetica-Bold").text("Scenario C: Full Turnkey (Architect + Designer + Contractor)");
    doc.fillColor(mutedGray).fontSize(9).font("Helvetica").lineGap(2).text(
        "Contractors carry the highest capital requirement for materials & labor. Recommended allocation:\n" +
        "1. Milestone 1 (50% Advance):\n" +
        "   - Architect (50% of contract): Site layout, master plan, structural blueprint.\n" +
        "   - Designer (50% of contract): Space planning, 3D renders, moodboard approval.\n" +
        "   - Contractor (50% of contract): Site mobilization, raw material procurement (steel/cement), labor mobilization.\n" +
        "2. Milestone 2 (25% Second Milestone):\n" +
        "   - Architect (30% of contract): Structural revision & intermediate inspection sign-off.\n" +
        "   - Designer (20% of contract): Plumbing & electrical placement coordination.\n" +
        "   - Contractor (25% of contract): Completion of civil structure, brickwork, slab casting, and MEP conduit rough-ins.\n" +
        "3. Milestone 3 (25% Final Payment):\n" +
        "   - Architect (20% of contract): Final completion & compliance certificate.\n" +
        "   - Designer (30% of contract): Interior styling, fixture installation, cabinetry sign-off.\n" +
        "   - Contractor (25% of contract): Painting, flooring, snag resolution checklist clearance, and physical key handover."
    );
    doc.moveDown(0.8);

    // Scenario D
    doc.fillColor(primaryDark).fontSize(10.5).font("Helvetica-Bold").text("Scenario D: Extended Team (+ Material Suppliers & MEP Engineers)");
    doc.fillColor(mutedGray).fontSize(9).font("Helvetica").lineGap(2).text(
        "• Material Suppliers: 70% released in Milestone 1 (procurement advance), 30% in Milestone 2 upon delivery verification.\n" +
        "• MEP / HVAC Consultants: 60% in Milestone 1 (schematic design), 40% in Milestone 2 upon physical ducting testing."
    );
    doc.moveDown(1);

    // --- Section 4: Architecture Directives for Next Phase ---
    doc.fillColor(primaryDark).fontSize(13).font("Helvetica-Bold").text("4. Engineering Directives for Next Phase Implementation");
    doc.moveDown(0.4);
    doc.fillColor(mutedGray).fontSize(9.5).font("Helvetica").lineGap(2.5).text(
        "1. Milestone Release Dispatcher Service: Create a dedicated backend service to calculate and execute atomic releases from ProjectEscrow to individual specialist personal wallets.\n" +
        "2. Specialist Dispute Isolation: If a client disputes one provider (e.g. Contractor delay), only that provider's contract portion is frozen, while Architect and Designer receive approved payouts without disruption.\n" +
        "3. Automatic Settlement Ledger: Every release creates an immutable WalletTransaction linking Project ID, Milestone Sequence, Client, and Specialist with GST-compliant payout invoices."
    );
    doc.moveDown(1.5);

    // Footer Signature Box
    doc.rect(45, doc.y, 505, 40).fillAndStroke("#F3F4F6", borderGray);
    doc.fillColor(primaryDark).fontSize(8.5).font("Helvetica-Bold").text("APPROVED ARCHITECTURAL SPECIFICATION", 60, doc.y + 12);
    doc.fillColor(mutedGray).fontSize(8).font("Helvetica").text("Night Owl Designers • Engineering & Financial Platform Team • Version 2.0", 60, doc.y + 24);

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on("finish", () => {
            // Also copy to brain directory for artifact access
            try {
                fs.copyFileSync(outputFile, brainPdfFile);
            } catch (e) {}
            resolve(outputFile);
        });
        stream.on("error", reject);
    });
}

generatePdf()
    .then((filePath) => {
        console.log("PDF generated successfully at:", filePath);
        process.exit(0);
    })
    .catch((err) => {
        console.error("PDF generation failed:", err);
        process.exit(1);
    });
