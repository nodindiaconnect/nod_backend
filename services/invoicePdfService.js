import PDFDocument from "pdfkit";
import InvoiceService from "./invoiceService.js";
import prisma from "../config/prismaClient.js";

class InvoicePdfService {
    /**
     * Generate Invoice PDF and pipe to Express response stream
     * @param {string} invoiceId 
     * @param {object} userOrAdmin 
     * @param {import("express").Response} res 
     */
    static async streamInvoicePdf(invoiceId, userOrAdmin, res) {
        const invoice = await InvoiceService.getInvoiceById(invoiceId, userOrAdmin);
        const project = await prisma.project.findUnique({
            where: { id: invoice.projectId },
            select: { id: true, title: true, location: true, category: true, projectType: true, totalCost: true },
        });

        const doc = new PDFDocument({
            size: "A4",
            margins: { top: 40, bottom: 40, left: 45, right: 45 },
        });

        // Set HTTP Response Headers for streaming PDF
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${invoice.invoiceNumber}.pdf"`
        );

        doc.pipe(res);

        // Color Palette
        const goldColor = "#A67C1E";
        const primaryDark = "#111827";
        const mutedGray = "#4B5563";
        const lightBg = "#F9FAFB";
        const borderGray = "#E5E7EB";
        const emeraldGreen = "#047857";

        // Header Background
        doc.rect(45, 35, 505, 60).fillAndStroke(lightBg, borderGray);

        // Header Logo / Brand
        doc.fillColor(goldColor).fontSize(16).font("Helvetica-Bold").text("NIGHT OWL DESIGNERS (NOD)", 60, 48);
        doc.fillColor(primaryDark).fontSize(8).font("Helvetica").text("ARCHITECTURE • INTERIOR DESIGN • CONSTRUCTION", 60, 68);

        // Invoice Tag & Status
        doc.fillColor(emeraldGreen).fontSize(12).font("Helvetica-Bold").text("TAX INVOICE — PAID", 360, 48, { align: "right" });
        doc.fillColor(mutedGray).fontSize(8).font("Helvetica").text(`Invoice: ${invoice.invoiceNumber}`, 360, 64, { align: "right" });
        doc.fillColor(mutedGray).fontSize(8).font("Helvetica").text(
            `Date: ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}`,
            360,
            76,
            { align: "right" }
        );

        doc.moveDown(4);

        // 2-Column Info: Billed To (Left) & Payment Details (Right)
        const topY = 115;
        doc.rect(45, topY, 245, 100).fillAndStroke("#FFFFFF", borderGray);
        doc.rect(305, topY, 245, 100).fillAndStroke("#FFFFFF", borderGray);

        // Billed To
        doc.fillColor(goldColor).fontSize(10).font("Helvetica-Bold").text("BILLED TO", 55, topY + 10);
        doc.fillColor(primaryDark).fontSize(10).font("Helvetica-Bold").text(invoice.clientName || "Client", 55, topY + 26);
        doc.fillColor(mutedGray).fontSize(9).font("Helvetica").text(`Email: ${invoice.clientEmail || "N/A"}`, 55, topY + 42);
        doc.fillColor(mutedGray).fontSize(9).font("Helvetica").text(`Phone: ${invoice.clientPhone || "N/A"}`, 55, topY + 56);
        doc.fillColor(mutedGray).fontSize(9).font("Helvetica").text(`Project: ${project?.title || "Project #" + invoice.projectId}`, 55, topY + 70);

        // Payment Info
        doc.fillColor(goldColor).fontSize(10).font("Helvetica-Bold").text("PAYMENT DETAILS", 315, topY + 10);
        doc.fillColor(primaryDark).fontSize(9).font("Helvetica-Bold").text(`Transaction ID: ${invoice.transactionId}`, 315, topY + 26);
        doc.fillColor(mutedGray).fontSize(9).font("Helvetica").text(`Gateway: ${invoice.paymentGateway || "Razorpay / Escrow"}`, 315, topY + 42);
        doc.fillColor(mutedGray).fontSize(9).font("Helvetica").text(`Milestone: #${invoice.milestoneSequence} (${invoice.milestonePercentage}%)`, 315, topY + 56);
        doc.fillColor(emeraldGreen).fontSize(9).font("Helvetica-Bold").text("Status: CONFIRMED & IN ESCROW", 315, topY + 70);

        // Table of Charges
        const tableY = 235;
        doc.rect(45, tableY, 505, 25).fill(lightBg);
        doc.rect(45, tableY, 505, 25).stroke(borderGray);

        doc.fillColor(primaryDark).fontSize(9).font("Helvetica-Bold");
        doc.text("DESCRIPTION", 55, tableY + 8);
        doc.text("RATE / %", 330, tableY + 8);
        doc.text("AMOUNT (INR)", 440, tableY + 8, { align: "right" });

        // Row 1: Milestone Amount
        let currentY = tableY + 25;
        doc.rect(45, currentY, 505, 30).fillAndStroke("#FFFFFF", borderGray);
        doc.fillColor(primaryDark).fontSize(9).font("Helvetica");
        doc.text(invoice.milestoneTitle || `Project Milestone #${invoice.milestoneSequence} Payout`, 55, currentY + 10);
        doc.text(`${invoice.milestonePercentage}%`, 330, currentY + 10);
        doc.font("Helvetica-Bold").text(`₹ ${Number(invoice.milestoneAmount).toLocaleString("en-IN")}`, 440, currentY + 10, { align: "right" });

        // Row 2: Platform Fee
        currentY += 30;
        doc.rect(45, currentY, 505, 30).fillAndStroke("#FFFFFF", borderGray);
        doc.fillColor(primaryDark).fontSize(9).font("Helvetica");
        doc.text("NOD Platform Escrow & Tech Fee", 55, currentY + 10);
        doc.text(`${invoice.platformFeeRate}%`, 330, currentY + 10);
        doc.font("Helvetica-Bold").text(`₹ ${Number(invoice.platformFeeAmount).toLocaleString("en-IN")}`, 440, currentY + 10, { align: "right" });

        // Total Row
        currentY += 30;
        doc.rect(45, currentY, 505, 35).fill(lightBg);
        doc.rect(45, currentY, 505, 35).stroke(borderGray);
        doc.fillColor(goldColor).fontSize(11).font("Helvetica-Bold").text("TOTAL AMOUNT PAID", 55, currentY + 12);
        doc.fillColor(primaryDark).fontSize(12).font("Helvetica-Bold").text(`₹ ${Number(invoice.totalAmountPaid).toLocaleString("en-IN")}`, 440, currentY + 12, { align: "right" });

        // Balance Summary Box
        currentY += 45;
        doc.rect(45, currentY, 505, 45).fillAndStroke("#FAFAFA", borderGray);
        doc.fillColor(mutedGray).fontSize(8).font("Helvetica");
        doc.text(`Total Contract Value: ₹ ${Number(invoice.totalProjectValue).toLocaleString("en-IN")}`, 55, currentY + 10);
        doc.text(`Remaining Project Balance: ₹ ${Number(invoice.remainingAmount).toLocaleString("en-IN")}`, 55, currentY + 24);
        doc.text("All funds are held in secure tripartite escrow until milestone inspection and sign-off.", 230, currentY + 17, { width: 300, align: "right" });

        // Footer Note
        const footerY = 720;
        doc.moveTo(45, footerY).lineTo(550, footerY).stroke(borderGray);
        doc.fillColor(mutedGray).fontSize(8).font("Helvetica");
        doc.text("Night Owl Designers (NOD) • nodindiaconnect@gmail.com • www.nodindia.com", 45, footerY + 10, { align: "center" });
        doc.text("This is a computer-generated receipt/invoice and does not require a physical signature.", 45, footerY + 22, { align: "center" });

        doc.end();
    }
}

export default InvoicePdfService;
