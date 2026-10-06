import prisma from "../config/prismaClient.js";
import SystemConfigService from "./systemConfigService.js";
import TaxService from "./taxService.js";

class PaymentCalculationService {
    /**
     * Compute comprehensive, mathematically exact payment breakdown for a project
     */
    static async calculateProjectPaymentSummary(projectId, tx = prisma) {
        const project = await tx.project.findUnique({
            where: { id: projectId },
            include: {
                awards: {
                    include: {
                        bid: true,
                        contract: {
                            include: {
                                milestones: {
                                    orderBy: { sequence: "asc" },
                                },
                            },
                        },
                    },
                },
                escrow: {
                    include: {
                        transactions: {
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
            },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        // 1. Calculate Total Awarded Project Value
        let totalProjectValue = 0;
        const awardedContracts = [];

        for (const award of project.awards) {
            let amount = 0;
            if (award.contract) {
                amount = Number(award.contract.totalAmount || 0);
            } else if (award.bid) {
                amount = Number(award.bid.quotedPrice || award.bid.amount || 0);
            }
            totalProjectValue += amount;
            awardedContracts.push({
                awardId: award.id,
                role: award.role,
                amount,
                contractId: award.contract?.id || null,
                milestones: award.contract?.milestones || [],
            });
        }

        // If approvedProjectAmount is locked on the project, use it as single source of financial truth
        if (project.approvedProjectAmount && Number(project.approvedProjectAmount) > 0) {
            totalProjectValue = Number(project.approvedProjectAmount);
        } else if (totalProjectValue === 0 && project.budgetMin && project.budgetMax) {
            // If no contracts awarded yet, fallback to budget average or 0
            totalProjectValue = Math.round((Number(project.budgetMin) + Number(project.budgetMax)) / 2);
        }

        // 2. Fetch Dynamic Platform Fee %
        const platformFeeRate = await SystemConfigService.getPlatformFeePercentage();

        // 3. Centralized Tax & Payment Breakdown via TaxService
        const taxBreakdown = TaxService.calculateBreakdown({
            baseProjectAmount: totalProjectValue,
            platformFeeRate,
        });

        const advanceAmount = taxBreakdown.advanceAmount;
        const secondMilestoneAmount = taxBreakdown.secondMilestoneAmount;
        const finalMilestoneAmount = taxBreakdown.finalMilestoneAmount;
        const platformFeeAmount = taxBreakdown.platformFeeAmount;
        const totalClientPayable = taxBreakdown.totalClientPayable;
        const advancePayableWithFee = taxBreakdown.advancePayableWithFee;

        // 4. Escrow and Milestone Payment State
        const escrow = project.escrow;
        // 100% upfront payment check
        const isEscrowFullyFunded = Boolean(
            escrow &&
            (escrow.initialDepositPaid >= totalProjectValue || escrow.status === "FUNDED" || escrow.status === "COMPLETED") &&
            escrow.platformFeePaid
        );

        // Analyze Milestone statuses across contracts
        const allMilestones = awardedContracts.flatMap((c) => c.milestones);
        const m1Milestones = allMilestones.filter((m) => m.sequence === 1);
        const m2Milestones = allMilestones.filter((m) => m.sequence === 2);
        const m3Milestones = allMilestones.filter((m) => m.sequence === 3);

        const isM1Approved = m1Milestones.length > 0 && m1Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
        const isM2Approved = m2Milestones.length > 0 && m2Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
        const isM3Approved = m3Milestones.length > 0 && m3Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));

        const isAdvancePaid = isEscrowFullyFunded;
        const isM2Paid = isM2Approved;
        const isM3Paid = isM3Approved;

        // Total paid so far
        let totalPaid = 0;
        if (isEscrowFullyFunded) {
            totalPaid = totalClientPayable;
        }

        const remainingAmount = Math.max(0, totalClientPayable - totalPaid);

        // Client pays 100% upfront into escrow
        let currentMilestone = isEscrowFullyFunded ? 2 : 1;
        let currentDueAmount = isEscrowFullyFunded ? 0 : totalClientPayable;

        const milestonesRoadmap = [
            {
                sequence: 1,
                title: "100% Full Project Escrow Deposit",
                subtitle: "100% Upfront Secure Escrow Deposit Before Specialist Activation",
                percentage: 100,
                baseAmount: totalProjectValue,
                platformFeeRate,
                platformFeeAmount,
                totalPayable: totalClientPayable,
                isPaid: isEscrowFullyFunded,
                isLocked: false,
                lockReasons: [],
                status: isEscrowFullyFunded ? "PAID" : "DUE",
                paidAt: isEscrowFullyFunded ? (escrow?.createdAt || new Date()) : null,
            },
        ];

        return {
            projectId: project.id,
            projectTitle: project.title,
            projectCategory: project.category,
            projectStatus: project.status,
            projectDeliveryType: project.projectDeliveryType || "TWO_D_PLUS_THREE_D",
            approvedProjectAmount: totalProjectValue,
            downloadEnabled: Boolean(project.downloadEnabled || project.status === "COMPLETED"),
            totalProjectValue,
            platformFeeRate,
            platformFeeAmount,
            designerCommissionRate: taxBreakdown.designerCommissionRate,
            designerCommissionAmount: taxBreakdown.designerCommissionAmount,
            nonRefundableRate: taxBreakdown.nonRefundableRate,
            nonRefundableAmount: taxBreakdown.nonRefundableAmount,
            gstRate: taxBreakdown.gstRate,
            totalGst: taxBreakdown.totalGst,
            designerEligiblePayout: taxBreakdown.designerEligiblePayout,
            platformRevenue: taxBreakdown.platformRevenue,
            netPlatformEarnings: taxBreakdown.netPlatformEarnings,
            totalClientPayable,
            advanceAmount,
            advancePayableWithFee,
            secondMilestoneAmount,
            finalMilestoneAmount,
            totalPaid,
            remainingAmount,
            currentMilestone,
            currentDueAmount,
            isAdvancePaid,
            isM2Paid,
            isM3Paid,
            isFullyPaid: isAdvancePaid && isM2Paid && isM3Paid,
            milestones: milestonesRoadmap,
            awardedContracts,
            escrowStatus: escrow?.status || "UNFUNDED",
            escrowBalance: escrow?.escrowBalance || 0,
        };
    }
}

export default PaymentCalculationService;
