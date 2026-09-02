import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

class InvoiceService {
    /**
     * Generate a unique sequential invoice number
     */
    static async generateInvoiceNumber(tx = prisma) {
        const year = new Date().getFullYear();
        const count = await tx.invoice.count();
        const sequence = String(count + 1).padStart(5, "0");
        return `INV-NOD-${year}-${sequence}`;
    }

    /**
     * Create an invoice record for a completed milestone payment
     */
    static async createMilestoneInvoice(
        tx,
        {
            projectId,
            clientId,
            milestoneId = null,
            milestoneSequence = 1,
            milestoneTitle,
            milestonePercentage = 50.0,
            totalProjectValue,
            milestoneAmount,
            platformFeeRate = 5.0,
            platformFeeAmount = 0,
            totalAmountPaid,
            remainingAmount = 0,
            transactionId = null,
            paymentGateway = "DUMMY",
            metadata = {},
        }
    ) {
        // Fetch client details
        const client = await tx.user.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, email: true, phone: true },
        });

        // Check if invoice for this milestone on this project already exists to prevent duplicates
        const existing = await tx.invoice.findFirst({
            where: {
                projectId,
                milestoneSequence,
                status: "PAID",
            },
        });

        if (existing) {
            logger.info(`[InvoiceService] Existing invoice ${existing.invoiceNumber} found for project ${projectId} milestone ${milestoneSequence}`);
            return existing;
        }

        const invoiceNumber = await InvoiceService.generateInvoiceNumber(tx);

        const invoice = await tx.invoice.create({
            data: {
                invoiceNumber,
                projectId,
                clientId,
                clientName: client?.name || "Verified Client",
                clientEmail: client?.email || "",
                clientPhone: client?.phone || "",
                milestoneId,
                milestoneSequence,
                milestoneTitle: milestoneTitle || `Milestone ${milestoneSequence} Payment`,
                milestonePercentage: Number(milestonePercentage),
                totalProjectValue: Number(totalProjectValue),
                milestoneAmount: Number(milestoneAmount),
                platformFeeRate: Number(platformFeeRate),
                platformFeeAmount: Number(platformFeeAmount),
                totalAmountPaid: Number(totalAmountPaid),
                remainingAmount: Number(remainingAmount),
                transactionId: transactionId || `TXN-${Date.now()}`,
                paymentGateway,
                status: "PAID",
                metadata,
                paidAt: new Date(),
            },
        });

        logger.info(`[InvoiceService] Generated invoice ${invoiceNumber} for project ${projectId}`);
        return invoice;
    }

    /**
     * Get all invoices for a project
     */
    static async getProjectInvoices(projectId, userOrAdmin) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: true },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = userOrAdmin.role === 0 || userOrAdmin.role === 7;
        const isClient = project.clientId === userOrAdmin.id;
        const isTeamMember = project.teamMembers.some((m) => m.userId === userOrAdmin.id);

        if (!isAdmin && !isClient && !isTeamMember) {
            throw new Error("Unauthorized to access project invoices");
        }

        const invoices = await prisma.invoice.findMany({
            where: { projectId },
            orderBy: { milestoneSequence: "asc" },
        });

        return invoices;
    }

    /**
     * Get invoice by ID
     */
    static async getInvoiceById(invoiceId, userOrAdmin) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        const project = await prisma.project.findUnique({
            where: { id: invoice.projectId },
            include: { teamMembers: true },
        });

        const isAdmin = userOrAdmin.role === 0 || userOrAdmin.role === 7;
        const isClient = invoice.clientId === userOrAdmin.id;
        const isTeamMember = project?.teamMembers.some((m) => m.userId === userOrAdmin.id);

        if (!isAdmin && !isClient && !isTeamMember) {
            throw new Error("Unauthorized to view this invoice");
        }

        return invoice;
    }
}

export default InvoiceService;
