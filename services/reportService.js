import ExcelJS from "exceljs";
import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

class ReportService {
    /**
     * Aggregate monthly financial metrics for Admin Dashboard
     */
    static async getMonthlyFinancialReport(year, month) {
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;

        const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

        const [
            transactions,
            invoices,
            payouts,
            disputes,
            projectsCount,
        ] = await Promise.all([
            prisma.financialTransaction.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { project: { select: { title: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.invoice.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.designerPayoutQueue.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { project: { select: { title: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.projectDispute.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.project.count({
                where: { createdAt: { gte: startDate, lte: endDate }, isDeleted: false },
            }),
        ]);

        // Aggregate key financial metrics
        let grossTransactionValue = 0;
        let platformFeesCollected = 0;
        let designerCommissionCollected = 0;
        let nonRefundableFees = 0;
        let totalRefundsIssued = 0;
        let designerPayoutsPaid = 0;
        let designerPayoutsPending = 0;

        for (const tx of transactions) {
            if (tx.type === "MILESTONE_PAYMENT") grossTransactionValue += tx.amount;
            if (tx.type === "PLATFORM_FEE") platformFeesCollected += tx.amount;
            if (tx.type === "DESIGNER_COMMISSION") designerCommissionCollected += tx.amount;
            if (tx.type === "NON_REFUNDABLE_FEE") nonRefundableFees += tx.amount;
            if (tx.type === "CLIENT_REFUND") totalRefundsIssued += tx.amount;
        }

        for (const p of payouts) {
            if (p.status === "PAID") designerPayoutsPaid += p.eligiblePayoutAmount;
            if (p.status === "PENDING" || p.status === "UNDER_REVIEW" || p.status === "PROCESSING") {
                designerPayoutsPending += p.eligiblePayoutAmount;
            }
        }

        const totalPlatformRevenue = platformFeesCollected + designerCommissionCollected + nonRefundableFees;
        const totalGstCollected = Math.round(platformFeesCollected * 0.18); // 18% GST on platform fee
        const netPlatformEarnings = totalPlatformRevenue - totalRefundsIssued;

        return {
            period: { year: y, month: m, startDate, endDate },
            projectsCount,
            grossTransactionValue,
            totalPlatformRevenue,
            platformFeesCollected,
            designerCommissionCollected,
            nonRefundableFees,
            totalGstCollected,
            designerPayoutsPaid,
            designerPayoutsPending,
            totalRefundsIssued,
            netPlatformEarnings,
            counts: {
                transactions: transactions.length,
                invoices: invoices.length,
                payouts: payouts.length,
                disputes: disputes.length,
            },
        };
    }

    /**
     * Generate Comprehensive Multi-Sheet Excel Financial Report
     */
    static async generateMonthlyExcel(year, month) {
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

        const [
            transactions,
            invoices,
            payouts,
            withdrawals,
            disputes,
            milestones,
        ] = await Promise.all([
            prisma.financialTransaction.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { project: { select: { id: true, title: true, projectDeliveryType: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.invoice.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.designerPayoutQueue.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { project: { select: { id: true, title: true, projectDeliveryType: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.withdrawal.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: {
                    wallet: {
                        include: {
                            user: { select: { name: true, email: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),

            prisma.projectDispute.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { escrow: { include: { project: { select: { id: true, title: true } } } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.milestone.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { contract: { include: { award: { include: { project: { select: { id: true, title: true } } } } } } },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "NOD Platform";
        workbook.created = new Date();

        const styleHeader = (row) => {
            row.eachCell((cell) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "4A3428" }, // NOD Deep Brown brand
                };
                cell.font = { color: { argb: "FFFFFF" }, bold: true };
                cell.alignment = { vertical: "middle", horizontal: "center" };
            });
        };

        // ── Sheet 1: Transactions ──
        const txSheet = workbook.addWorksheet("Transactions");
        txSheet.columns = [
            { header: "Transaction ID", key: "internalTxnId", width: 28 },
            { header: "Date", key: "createdAt", width: 20 },
            { header: "Project ID", key: "projectId", width: 25 },
            { header: "Project Title", key: "projectTitle", width: 25 },
            { header: "Type", key: "type", width: 24 },
            { header: "Amount (₹)", key: "amount", width: 16 },
            { header: "Gateway", key: "gateway", width: 18 },
            { header: "Gateway Ref ID", key: "gatewayTransactionId", width: 25 },
            { header: "Status", key: "status", width: 14 },
        ];
        styleHeader(txSheet.getRow(1));
        transactions.forEach((tx) => {
            txSheet.addRow({
                internalTxnId: tx.internalTxnId,
                createdAt: tx.createdAt.toISOString().slice(0, 19).replace("T", " "),
                projectId: tx.projectId,
                projectTitle: tx.project?.title || "N/A",
                type: tx.type,
                amount: tx.amount,
                gateway: tx.gateway || "RAZORPAY",
                gatewayTransactionId: tx.gatewayTransactionId || "N/A",
                status: tx.status,
            });
        });

        // ── Sheet 2: Invoices ──
        const invSheet = workbook.addWorksheet("Invoices");
        invSheet.columns = [
            { header: "Invoice Number", key: "invoiceNumber", width: 24 },
            { header: "Date", key: "createdAt", width: 20 },
            { header: "Project ID", key: "projectId", width: 25 },
            { header: "Client Name", key: "clientName", width: 22 },
            { header: "Milestone", key: "milestoneTitle", width: 25 },
            { header: "Milestone Amount (₹)", key: "milestoneAmount", width: 20 },
            { header: "Platform Fee (₹)", key: "platformFeeAmount", width: 18 },
            { header: "Total Paid (₹)", key: "totalAmountPaid", width: 18 },
            { header: "Payment Ref", key: "transactionId", width: 25 },
            { header: "Status", key: "status", width: 14 },
        ];
        styleHeader(invSheet.getRow(1));
        invoices.forEach((inv) => {
            invSheet.addRow({
                invoiceNumber: inv.invoiceNumber,
                createdAt: inv.createdAt.toISOString().slice(0, 19).replace("T", " "),
                projectId: inv.projectId,
                clientName: inv.clientName || "N/A",
                milestoneTitle: inv.milestoneTitle,
                milestoneAmount: inv.milestoneAmount,
                platformFeeAmount: inv.platformFeeAmount,
                totalAmountPaid: inv.totalAmountPaid,
                transactionId: inv.transactionId || "N/A",
                status: inv.status,
            });
        });

        // ── Sheet 3: Designer Payouts ──
        const payoutSheet = workbook.addWorksheet("Designer Payouts");
        payoutSheet.columns = [
            { header: "Payout ID", key: "id", width: 25 },
            { header: "Project ID", key: "projectId", width: 25 },
            { header: "Project Title", key: "projectTitle", width: 25 },
            { header: "Designer ID", key: "designerId", width: 25 },
            { header: "Gross Amount (₹)", key: "grossAmount", width: 18 },
            { header: "Commission Deducted (₹)", key: "designerCommission", width: 24 },
            { header: "Eligible Payout (₹)", key: "eligiblePayoutAmount", width: 20 },
            { header: "Status", key: "status", width: 16 },
            { header: "Bank/UPI Reference", key: "bankReferenceNumber", width: 24 },
            { header: "Payment Date", key: "paymentDate", width: 20 },
            { header: "Admin Notes", key: "notes", width: 25 },
        ];
        styleHeader(payoutSheet.getRow(1));
        payouts.forEach((p) => {
            payoutSheet.addRow({
                id: p.id,
                projectId: p.projectId,
                projectTitle: p.project?.title || "N/A",
                designerId: p.designerId,
                grossAmount: p.grossAmount,
                designerCommission: p.designerCommission,
                eligiblePayoutAmount: p.eligiblePayoutAmount,
                status: p.status,
                bankReferenceNumber: p.bankReferenceNumber || "N/A",
                paymentDate: p.paymentDate ? p.paymentDate.toISOString().slice(0, 10) : "N/A",
                notes: p.notes || "",
            });
        });

        // ── Sheet 4: Withdrawals ──
        const wSheet = workbook.addWorksheet("Withdrawals");
        wSheet.columns = [
            { header: "Withdrawal ID", key: "id", width: 25 },
            { header: "Specialist", key: "userName", width: 22 },
            { header: "Specialist Email", key: "userEmail", width: 25 },
            { header: "Amount (₹)", key: "amount", width: 16 },
            { header: "Bank Account", key: "bankAccount", width: 20 },
            { header: "IFSC Code", key: "ifscCode", width: 16 },
            { header: "Status", key: "status", width: 16 },
            { header: "Date", key: "createdAt", width: 20 },
        ];
        styleHeader(wSheet.getRow(1));
        withdrawals.forEach((w) => {
            wSheet.addRow({
                id: w.id,
                userName: w.wallet?.user?.name || w.accountHolder || "N/A",
                userEmail: w.wallet?.user?.email || "N/A",
                amount: w.amount,

                bankAccount: w.bankAccount || "N/A",
                ifscCode: w.ifscCode || "N/A",
                status: w.status,
                createdAt: w.createdAt.toISOString().slice(0, 19).replace("T", " "),
            });
        });

        // ── Sheet 5: Refunds & Disputes ──
        const dSheet = workbook.addWorksheet("Disputes & Refunds");
        dSheet.columns = [
            { header: "Dispute ID", key: "id", width: 25 },
            { header: "Project ID", key: "projectId", width: 25 },
            { header: "Project Title", key: "projectTitle", width: 25 },
            { header: "Disputed Amount (₹)", key: "disputedAmount", width: 20 },
            { header: "Approved Designer Amount (₹)", key: "adminApprovedDesignerAmount", width: 28 },
            { header: "Client Refund Amount (₹)", key: "calculatedClientRefund", width: 24 },
            { header: "Status", key: "status", width: 18 },
            { header: "Admin Notes", key: "adminNotes", width: 30 },
            { header: "Resolved Date", key: "resolvedAt", width: 20 },
        ];
        styleHeader(dSheet.getRow(1));
        disputes.forEach((d) => {
            dSheet.addRow({
                id: d.id,
                projectId: d.escrow?.project?.id || "N/A",
                projectTitle: d.escrow?.project?.title || "N/A",
                disputedAmount: d.disputedAmount,
                adminApprovedDesignerAmount: d.adminApprovedDesignerAmount || 0,
                calculatedClientRefund: d.calculatedClientRefund || 0,
                status: d.status,
                adminNotes: d.adminNotes || d.settlementNotes || "",
                resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString().slice(0, 10) : "N/A",
            });
        });

        return await workbook.xlsx.writeBuffer();
    }
}

export default ReportService;
