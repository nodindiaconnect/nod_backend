import prisma from "../config/prismaClient.js";
import SystemConfigService from "./systemConfigService.js";

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

        // If no contracts awarded yet, fallback to budget average or 0
        if (totalProjectValue === 0 && project.budgetMin && project.budgetMax) {
            totalProjectValue = Math.round((Number(project.budgetMin) + Number(project.budgetMax)) / 2);
        }

        // 2. Fetch Dynamic Platform Fee %
        const platformFeeRate = await SystemConfigService.getPlatformFeePercentage();

        // 3. Exact Milestone Value Calculations
        const advanceAmount = Math.round(totalProjectValue * 0.50); // 50%
        const secondMilestoneAmount = Math.round(totalProjectValue * 0.25); // 25%
        const finalMilestoneAmount = totalProjectValue - (advanceAmount + secondMilestoneAmount); // Remaining 25%
        const platformFeeAmount = Math.round(totalProjectValue * (platformFeeRate / 100));
        const totalClientPayable = totalProjectValue + platformFeeAmount;
        const advancePayableWithFee = advanceAmount + platformFeeAmount;

        // 4. Escrow and Milestone Payment State
        const escrow = project.escrow;
        const isAdvancePaid = Boolean(escrow && escrow.initialDepositPaid >= advanceAmount && escrow.platformFeePaid);

        // Analyze Milestone statuses across contracts
        const allMilestones = awardedContracts.flatMap((c) => c.milestones);
        const m1Milestones = allMilestones.filter((m) => m.sequence === 1);
        const m2Milestones = allMilestones.filter((m) => m.sequence === 2);
        const m3Milestones = allMilestones.filter((m) => m.sequence === 3);

        const isM1Approved = m1Milestones.length > 0 && m1Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
        const isM2Paid = m2Milestones.length > 0 && m2Milestones.every((m) => ["PAID", "APPROVED"].includes(m.status));
        const isM2Approved = m2Milestones.length > 0 && m2Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
        const isM3Paid = m3Milestones.length > 0 && m3Milestones.every((m) => ["PAID", "APPROVED"].includes(m.status));

        // Total paid so far
        let totalPaid = 0;
        if (isAdvancePaid) {
            totalPaid += advanceAmount + platformFeeAmount;
        }
        if (isM2Paid) {
            totalPaid += secondMilestoneAmount;
        }
        if (isM3Paid) {
            totalPaid += finalMilestoneAmount;
        }

        const remainingAmount = Math.max(0, totalClientPayable - totalPaid);

        // Determine current actionable milestone
        let currentMilestone = 1;
        let currentDueAmount = 0;
        let canPaySecond = false;
        let secondLockReasons = [];
        let canPayFinal = false;
        let finalLockReasons = [];

        if (!isAdvancePaid) {
            currentMilestone = 1;
            currentDueAmount = advancePayableWithFee;
        } else if (!isM2Paid) {
            currentMilestone = 2;
            currentDueAmount = secondMilestoneAmount;

            // 1. Validate First 50% payment completed
            if (!isAdvancePaid) {
                secondLockReasons.push("First 50% advance payment must be completed");
            }
            // 2. Validate required documents submitted
            const m1DocsSubmitted = m1Milestones.length === 0 || m1Milestones.every((m) => (m.proofUrls && m.proofUrls.length > 0) || ["SUBMITTED_FOR_REVIEW", "APPROVED", "PAID"].includes(m.status));
            if (!m1DocsSubmitted) {
                secondLockReasons.push("Required drawings, specifications, and Phase 1 documents must be submitted");
            }
            // 3. Validate required documents and site visits verified / approved
            const m1DocsVerified = m1Milestones.length === 0 || m1Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
            if (!m1DocsVerified) {
                secondLockReasons.push("Phase 1 deliverables and site visit sign-offs must be verified and approved");
            }

            canPaySecond = secondLockReasons.length === 0;
        } else if (!isM3Paid) {
            currentMilestone = 3;
            currentDueAmount = finalMilestoneAmount;

            // 1. Validate First & Second payment completed
            if (!isAdvancePaid) {
                finalLockReasons.push("First 50% advance payment must be completed");
            }
            if (!isM2Paid) {
                finalLockReasons.push("Second 25% milestone payment must be completed");
            }
            // 2. Validate intermediate and execution documents submitted & verified
            const m2DocsSubmitted = m2Milestones.length === 0 || m2Milestones.every((m) => (m.proofUrls && m.proofUrls.length > 0) || ["SUBMITTED_FOR_REVIEW", "APPROVED", "PAID"].includes(m.status));
            if (!m2DocsSubmitted) {
                finalLockReasons.push("Core execution documents, site progress reports, and phase 2 deliverables must be submitted");
            }
            const m2DocsVerified = m2Milestones.length === 0 || m2Milestones.every((m) => ["APPROVED", "PAID"].includes(m.status));
            if (!m2DocsVerified) {
                finalLockReasons.push("Phase 2 deliverables and intermediate approvals must be verified");
            }
            // 3. Validate final handover, inspection checklist, and completion verified
            const m3DocsSubmitted = m3Milestones.length === 0 || m3Milestones.every((m) => (m.proofUrls && m.proofUrls.length > 0) || ["SUBMITTED_FOR_REVIEW", "APPROVED", "PAID"].includes(m.status));
            if (!m3DocsSubmitted) {
                finalLockReasons.push("Final handover inspection, snag resolution checklist, and completion reports must be submitted");
            }

            canPayFinal = finalLockReasons.length === 0;
        } else {
            currentMilestone = 4; // All completed
            currentDueAmount = 0;
        }

        const milestonesRoadmap = [
            {
                sequence: 1,
                title: "50% Initial Advance Deposit",
                subtitle: "Mobilization, Site Planning & Blueprint Initiation",
                percentage: 50,
                baseAmount: advanceAmount,
                platformFeeRate,
                platformFeeAmount,
                totalPayable: advancePayableWithFee,
                isPaid: isAdvancePaid,
                isLocked: false,
                lockReasons: [],
                status: isAdvancePaid ? "PAID" : "DUE",
                paidAt: escrow?.createdAt || null,
            },
            {
                sequence: 2,
                title: "25% Second Milestone",
                subtitle: "Core Execution, Intermediate Verification & Approvals",
                percentage: 25,
                baseAmount: secondMilestoneAmount,
                platformFeeRate: 0,
                platformFeeAmount: 0,
                totalPayable: secondMilestoneAmount,
                isPaid: isM2Paid,
                isLocked: !canPaySecond && !isM2Paid,
                lockReasons: secondLockReasons,
                status: isM2Paid ? "PAID" : canPaySecond ? "READY_TO_PAY" : "LOCKED",
                paidAt: null,
            },
            {
                sequence: 3,
                title: "25% Final Completion Payment",
                subtitle: "Final Quality Detailing, Handover & Snag List Resolution",
                percentage: 25,
                baseAmount: finalMilestoneAmount,
                platformFeeRate: 0,
                platformFeeAmount: 0,
                totalPayable: finalMilestoneAmount,
                isPaid: isM3Paid,
                isLocked: !canPayFinal && !isM3Paid,
                lockReasons: finalLockReasons,
                status: isM3Paid ? "PAID" : canPayFinal ? "READY_TO_PAY" : "LOCKED",
                paidAt: null,
            },
        ];

        return {
            projectId: project.id,
            projectTitle: project.title,
            projectCategory: project.category,
            projectStatus: project.status,
            totalProjectValue,
            platformFeeRate,
            platformFeeAmount,
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
