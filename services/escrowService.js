import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";
import ProjectStateMachine from "./projectStateMachine.js";
import { emitToProject, emitToUser } from "../socket/socketServer.js";
import SystemConfigService from "./systemConfigService.js";
import PaymentCalculationService from "./paymentCalculationService.js";
import InvoiceService from "./invoiceService.js";
import WalletService from "./walletService.js";

class EscrowService {
    /**
     * Compute Server-Side Time Tracker details safely
     */
    static computeTimeTracker(project, escrow) {
        const now = new Date();
        const startedAt = escrow?.updatedAt || project.startDate || project.createdAt;
        let deadline = project.endDate;
        if (!deadline) {
            // Default to 30 days from project creation/start
            deadline = new Date(new Date(startedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            deadline = new Date(deadline);
        }

        const diffMs = deadline.getTime() - now.getTime();
        const isDeadlineReached = diffMs <= 0 && project.status !== "COMPLETED";
        const timeRemainingDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const timeRemainingHours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

        return {
            startedAt,
            deadline,
            currentTime: now,
            isDeadlineReached,
            timeRemainingDays,
            timeRemainingHours,
            timeRemainingFormatted: isDeadlineReached
                ? "Deadline Reached (Action Required: Extension, Revision, Dispute, or Completion)"
                : `${timeRemainingDays} Days, ${timeRemainingHours} Hours Remaining`,
            status: project.status,
        };
    }

    /**
     * Initialize or recalculate dedicated Project Escrow account when bids are awarded
     */
    static async initializeOrUpdateProjectEscrow(projectId, tx = prisma) {
        const project = await tx.project.findUnique({
            where: { id: projectId },
            include: {
                awards: {
                    include: {
                        contract: true,
                        bid: true,
                    },
                },
            },
        });

        if (!project) throw new Error("Project not found");

        // Sum total awarded value across all accepted contracts
        let totalProjectValue = 0;
        for (const award of project.awards) {
            if (award.contract) {
                totalProjectValue += Number(award.contract.totalAmount || 0);
            } else if (award.bid) {
                totalProjectValue += Number(award.bid.quotedPrice || award.bid.amount || 0);
            }
        }

        if (totalProjectValue <= 0) return null;

        const platformFeeRate = await SystemConfigService.getPlatformFeePercentage();
        const initialDepositRequired = Math.round(totalProjectValue * 0.5);
        const remainingAmount = totalProjectValue - initialDepositRequired;
        const platformFeeAmount = Math.round(totalProjectValue * (platformFeeRate / 100));

        const existingEscrow = await tx.projectEscrow.findUnique({
            where: { projectId },
        });

        let escrow;
        if (existingEscrow) {
            escrow = await tx.projectEscrow.update({
                where: { projectId },
                data: {
                    totalProjectValue,
                    initialDepositRequired,
                    remainingAmount,
                    platformFeeRate,
                    platformFeeAmount,
                    ...(existingEscrow.status === "UNFUNDED" ? { status: "PAYMENT_REQUIRED" } : {}),
                },
            });
        } else {
            escrow = await tx.projectEscrow.create({
                data: {
                    projectId,
                    totalProjectValue,
                    initialDepositRequired,
                    remainingAmount,
                    platformFeeRate,
                    platformFeeAmount,
                    status: "PAYMENT_REQUIRED",
                },
            });
        }

        // Update project status to PAYMENT_REQUIRED if it's currently in bidding
        if (["WAITING_FOR_QUOTATIONS", "PROPOSALS_RECEIVED", "ROLE_SELECTED", "SELECTED", "HIRED"].includes(project.status)) {
            await tx.project.update({
                where: { id: projectId },
                data: { status: "PAYMENT_REQUIRED" },
            });
        }

        return escrow;
    }

    /**
     * Get Project Escrow / Financial Ledger with Role-Based Privacy & Time Tracker
     */
    static async getProjectEscrow(user, projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                client: {
                    select: { id: true, name: true, email: true },
                },
                escrow: {
                    include: {
                        transactions: {
                            orderBy: { createdAt: "desc" },
                            include: {
                                user: { select: { id: true, name: true, role: true } },
                            },
                        },
                        disputes: {
                            orderBy: { createdAt: "desc" },
                            include: {
                                raisedBy: { select: { id: true, name: true, role: true } },
                                resolvedBy: { select: { id: true, name: true, role: true } },
                            },
                        },
                    },
                },
                awards: {
                    include: {
                        bid: {
                            include: {
                                professional: { select: { id: true, name: true, email: true, profile: true } },
                                architect: { include: { user: { select: { id: true, name: true } } } },
                                designer: { include: { user: { select: { id: true, name: true } } } },
                                contractor: { include: { user: { select: { id: true, name: true } } } },
                            },
                        },
                        contract: {
                            include: {
                                milestones: {
                                    orderBy: { sequence: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = user.role === 0 || user.role === 7;
        const isClient = project.clientId === user.id;

        // Check if user is an awarded specialist on this project
        const myAward = project.awards.find((a) => {
            const proId =
                a.bid?.professionalId ||
                a.bid?.architect?.userId ||
                a.bid?.designer?.userId ||
                a.bid?.contractor?.userId;
            return proId === user.id;
        });

        if (!isAdmin && !isClient && !myAward) {
            throw new Error("Unauthorized: You do not have access to this project's escrow");
        }

        // Auto-create/sync escrow if missing but awards exist
        let escrow = project.escrow;
        if (!escrow && project.awards.length > 0) {
            escrow = await this.initializeOrUpdateProjectEscrow(projectId);
            return this.getProjectEscrow(user, projectId);
        }

        const timeTracker = this.computeTimeTracker(project, escrow);

        // 1. Client View (Full project financial transparency without leaking pros' personal wallets)
        if (isClient) {
            return {
                viewRole: "CLIENT",
                projectId: project.id,
                projectTitle: project.title,
                projectStatus: project.status,
                client: project.client,
                timeTracker,
                escrow: escrow || {
                    totalProjectValue: 0,
                    initialDepositRequired: 0,
                    initialDepositPaid: 0,
                    remainingAmount: 0,
                    platformFeeRate: 5.0,
                    platformFeeAmount: 0,
                    platformFeePaid: false,
                    escrowBalance: 0,
                    totalReleasedAmount: 0,
                    totalRefundedAmount: 0,
                    totalDisputedAmount: 0,
                    status: "UNFUNDED",
                    transactions: [],
                    disputes: [],
                },
                awards: project.awards,
            };
        }

        // 2. Specialist View (Private: only their contract, assigned milestones, project escrow health)
        if (myAward) {
            const myContract = myAward.contract;
            const myMilestones = myContract?.milestones || [];
            const myReleased = myMilestones
                .filter((m) => m.status === "PAID" || m.status === "APPROVED")
                .reduce((sum, m) => sum + (m.amount || 0), 0);
            const myTotal = myContract?.totalAmount || 0;
            const myPending = myTotal - myReleased;

            return {
                viewRole: "SPECIALIST",
                specialistRole: myAward.role,
                projectId: project.id,
                projectTitle: project.title,
                projectStatus: project.status,
                projectEscrowStatus: escrow?.status || "UNFUNDED",
                escrowFunded: escrow ? escrow.initialDepositPaid > 0 : false,
                timeTracker,
                myContract: {
                    id: myContract?.id,
                    totalAmount: myTotal,
                    releasedAmount: myReleased,
                    pendingAmount: myPending,
                    milestones: myMilestones,
                },
                myDisputes: (escrow?.disputes || []).filter(
                    (d) => d.raisedById === user.id || myMilestones.some((m) => m.id === d.milestoneId)
                ),
            };
        }

        // 3. Admin View (Complete Master Ledger)
        return {
            viewRole: "ADMIN",
            projectId: project.id,
            projectTitle: project.title,
            projectStatus: project.status,
            client: project.client,
            timeTracker,
            escrow,
            awards: project.awards,
        };
    }

    /**
     * Client creates Initial 50% Deposit + 5% Platform Fee Payment Order
     * (Calculated strictly on backend to prevent payment manipulation)
     */
    static async createInitialEscrowOrder(user, projectId, idempotencyKey = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { escrow: true },
        });

        if (!project) throw new Error("Project not found");
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can pay initial escrow");
        }

        let escrow = project.escrow;
        if (!escrow) {
            escrow = await this.initializeOrUpdateProjectEscrow(projectId);
        }

        if (!escrow || escrow.totalProjectValue <= 0) {
            throw new Error("No awarded contracts found on this project to fund escrow");
        }

        if (escrow.initialDepositPaid > 0 && escrow.platformFeePaid) {
            return {
                alreadyPaid: true,
                message: "Initial 50% deposit and 5% platform fee have already been funded.",
                escrow,
            };
        }

        // Calculate authoritative backend financial figures
        const initialDeposit50 = escrow.initialDepositRequired;
        const platformFee5 = escrow.platformFeeAmount;
        const totalPayable = initialDeposit50 + platformFee5;
        const generatedOrderId = `escrow_order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        return {
            projectId: project.id,
            projectTitle: project.title,
            orderId: generatedOrderId,
            totalProjectValue: escrow.totalProjectValue,
            initialDeposit50,
            platformFee5,
            totalPayable,
            currency: "INR",
            keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_designconnect",
            idempotencyKey: idempotencyKey || `idemp_escrow_${projectId}_${Date.now()}`,
        };
    }

    /**
     * Confirm Initial 50% Deposit + 5% Platform Fee Payment (Gateway Success / Webhook)
     */
    static async confirmInitialEscrowPayment(user, projectId, data = {}) {
        const { gatewayPaymentId, gatewayOrderId, rawPayload = {} } = data;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { escrow: true },
        });

        if (!project) throw new Error("Project not found");
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can confirm escrow payment");
        }

        let escrow = project.escrow;
        if (!escrow) {
            escrow = await this.initializeOrUpdateProjectEscrow(projectId);
        }

        const initialAmount = escrow.initialDepositRequired;
        const platformFee = escrow.platformFeeAmount;

        const updated = await prisma.$transaction(async (tx) => {
            // 1. Update ProjectEscrow
            const updatedEscrow = await tx.projectEscrow.update({
                where: { id: escrow.id },
                data: {
                    initialDepositPaid: initialAmount,
                    platformFeePaid: true,
                    escrowBalance: { increment: initialAmount },
                    status: "FUNDED",
                },
            });

            // 2. Record 50% Initial Deposit Transaction
            await tx.projectEscrowTransaction.create({
                data: {
                    escrowId: escrow.id,
                    type: "INITIAL_DEPOSIT_50",
                    amount: initialAmount,
                    userId: user.id,
                    description: `Client paid initial 50% deposit for project: ${project.title}`,
                    referenceId: gatewayPaymentId || gatewayOrderId || `pay_${Date.now()}`,
                    status: "COMPLETED",
                },
            });

            // 3. Record 5% Platform Fee Transaction
            await tx.projectEscrowTransaction.create({
                data: {
                    escrowId: escrow.id,
                    type: "PLATFORM_FEE_5",
                    amount: platformFee,
                    platformFee: platformFee,
                    userId: user.id,
                    description: `5% Platform Service Fee collected on ₹${escrow.totalProjectValue} project value`,
                    referenceId: gatewayPaymentId || gatewayOrderId || `fee_${Date.now()}`,
                    status: "COMPLETED",
                },
            });

            // 4. Record in Platform Revenue Ledger
            await tx.platformRevenue.create({
                data: {
                    projectId: project.id,
                    escrowId: escrow.id,
                    amount: platformFee,
                    source: "PROJECT_PLATFORM_FEE_5_PERCENT",
                    description: `5% Platform fee on project ${project.title} (ID: ${project.id})`,
                    referenceId: gatewayPaymentId || gatewayOrderId || `rev_${Date.now()}`,
                },
            });

            // 5. Update Milestone 1 across all awarded contracts to PAID
            const projectWithAwards = await tx.project.findUnique({
                where: { id: projectId },
                include: {
                    awards: {
                        include: {
                            contract: {
                                include: {
                                    milestones: { where: { sequence: 1 } },
                                },
                            },
                        },
                    },
                },
            });

            for (const award of projectWithAwards?.awards || []) {
                const m1 = award.contract?.milestones?.[0];
                if (m1) {
                    await tx.milestone.update({
                        where: { id: m1.id },
                        data: {
                            status: "PAID",
                            paidAt: new Date(),
                        },
                    });
                }
            }

            // 6. Generate Milestone 1 (50% Advance) Invoice
            const invoice = await InvoiceService.createMilestoneInvoice(tx, {
                projectId: project.id,
                clientId: user.id,
                milestoneSequence: 1,
                milestoneTitle: "50% Initial Advance Deposit & Platform Fee",
                milestonePercentage: 50.0,
                totalProjectValue: escrow.totalProjectValue,
                milestoneAmount: initialAmount,
                platformFeeRate: escrow.platformFeeRate,
                platformFeeAmount: platformFee,
                totalAmountPaid: initialAmount + platformFee,
                remainingAmount: escrow.remainingAmount,
                transactionId: gatewayPaymentId || gatewayOrderId || `pay_${Date.now()}`,
                paymentGateway: "DUMMY",
            });

            // 7. Update Project Status to IN_PROGRESS (Activate Time Tracker)
            await tx.project.update({
                where: { id: projectId },
                data: {
                    status: "IN_PROGRESS",
                    currentPhase: project.currentPhase || "PLANNING",
                    startDate: project.startDate || new Date(),
                },
            });

            // 8. Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: null,
                    action: "PROJECT_ESCROW_FUNDED",
                    entityType: "PROJECT_ESCROW",
                    entityId: escrow.id,
                    details: {
                        projectId: project.id,
                        initialDepositPaid: initialAmount,
                        platformFeePaid: platformFee,
                        status: "IN_PROGRESS",
                        invoiceNumber: invoice?.invoiceNumber,
                    },
                },
            });

            return {
                ...updatedEscrow,
                invoice,
            };
        });

        // Emit real-time updates
        emitToProject(projectId, "project:escrow_funded", {
            projectId,
            initialDepositPaid: initialAmount,
            platformFeePaid: platformFee,
            escrowBalance: initialAmount,
            status: "FUNDED",
        });

        emitToProject(projectId, "project:status_changed", {
            projectId,
            status: "IN_PROGRESS",
        });

        return updated;
    }

    /**
     * Unified Milestone Payment Engine (1: 50% Advance + Fee, 2: 25% Second, 3: 25% Final)
     */
    static async payMilestone(user, projectId, milestoneSequence = 1, data = {}) {
        const seq = Number(milestoneSequence);
        const summary = await PaymentCalculationService.calculateProjectPaymentSummary(projectId);

        if (seq === 1) {
            return await EscrowService.confirmInitialEscrowPayment(user, projectId, data);
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                client: true,
                escrow: true,
                awards: {
                    include: {
                        contract: {
                            include: {
                                milestones: { orderBy: { sequence: "asc" } },
                            },
                        },
                        bid: {
                            include: {
                                professional: true,
                                architect: true,
                                designer: true,
                                contractor: true,
                            },
                        },
                    },
                },
            },
        });

        if (!project || project.isDeleted) throw new Error("Project not found");
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can pay milestones");
        }

        const targetMilestoneData = summary.milestones.find((m) => m.sequence === seq);
        if (!targetMilestoneData) {
            throw new Error(`Invalid milestone sequence: ${seq}`);
        }

        if (targetMilestoneData.isPaid) {
            throw new Error(`Milestone ${seq} has already been paid`);
        }

        if (targetMilestoneData.isLocked) {
            throw new Error(`Milestone ${seq} is locked: ${targetMilestoneData.lockReasons.join("; ")}`);
        }

        const payableAmount = targetMilestoneData.totalPayable;
        const txnRef = data.gatewayPaymentId || data.referenceId || `txn_ms${seq}_${Date.now()}`;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update matching milestones across all project contracts
            for (const award of project.awards) {
                const ms = award.contract?.milestones?.find((m) => m.sequence === seq);
                if (ms) {
                    await tx.milestone.update({
                        where: { id: ms.id },
                        data: {
                            status: "PAID",
                            paidAt: new Date(),
                        },
                    });
                }
            }

            // 2. Increment Escrow Held Balance & record transaction in ProjectEscrow
            const escrow = project.escrow || (await EscrowService.initializeOrUpdateProjectEscrow(projectId, tx));
            await tx.projectEscrow.update({
                where: { id: escrow.id },
                data: {
                    escrowBalance: { increment: payableAmount },
                    status: seq === 3 ? "COMPLETED" : "IN_PROGRESS",
                },
            });

            await tx.projectEscrowTransaction.create({
                data: {
                    escrowId: escrow.id,
                    type: seq === 3 ? "FINAL_RELEASE" : "ESCROW_HOLD",
                    amount: payableAmount,
                    platformFee: 0,
                    userId: user.id,
                    description: `Client paid Milestone ${seq} (${targetMilestoneData.title}): ${project.title}`,
                    referenceId: txnRef,
                    status: "COMPLETED",
                },
            });

            // 4. If Milestone 3, mark project as COMPLETED
            if (seq === 3) {
                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        status: "COMPLETED",
                        availabilityStatus: "CLOSED",
                    },
                });
            }

            // 5. Generate automated Invoice
            const invoice = await InvoiceService.createMilestoneInvoice(tx, {
                projectId: project.id,
                clientId: user.id,
                milestoneSequence: seq,
                milestoneTitle: targetMilestoneData.title,
                milestonePercentage: targetMilestoneData.percentage,
                totalProjectValue: summary.totalProjectValue,
                milestoneAmount: payableAmount,
                platformFeeRate: 0,
                platformFeeAmount: 0,
                totalAmountPaid: payableAmount,
                remainingAmount: Math.max(0, summary.remainingAmount - payableAmount),
                transactionId: txnRef,
                paymentGateway: "DUMMY",
            });

            return {
                milestoneSequence: seq,
                amountPaid: payableAmount,
                status: "PAID",
                invoice,
            };
        });

        // Real-time broadcast
        emitToProject(projectId, "milestone:paid", {
            projectId,
            milestoneSequence: seq,
            amountPaid: payableAmount,
        });

        return result;
    }

    /**
     * Client Approves Milestone -> Triggers Automatic Escrow Release to Specialist's Personal Wallet
     * Includes atomic protection against double payment release and escrow overdraft
     */
    static async approveMilestoneAndReleaseEscrow(user, milestoneId) {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: {
                                project: {
                                    include: { escrow: true },
                                },
                                bid: {
                                    include: {
                                        architect: true,
                                        designer: true,
                                        contractor: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");

        const award = milestone.contract.award;
        const project = award.project;

        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can approve milestones and release escrow");
        }

        if (milestone.status === "PAID" || milestone.status === "APPROVED") {
            throw new Error("This milestone has already been approved and released");
        }

        let escrow = project.escrow;
        if (!escrow) {
            escrow = await this.initializeOrUpdateProjectEscrow(project.id);
        }

        // Determine Specialist User ID
        const bid = award.bid;
        const proUserId =
            bid.professionalId ||
            bid.architect?.userId ||
            bid.designer?.userId ||
            bid.contractor?.userId;

        if (!proUserId) {
            throw new Error("Cannot identify specialist user for payment release");
        }

        const milestoneAmount = Number(milestone.amount);

        const result = await prisma.$transaction(async (tx) => {
            // Check Escrow balance
            const currentEscrow = await tx.projectEscrow.findUnique({ where: { id: escrow.id } });
            if (!currentEscrow || currentEscrow.escrowBalance < milestoneAmount) {
                // If not enough balance held, replenish or check
                logger.warn(`Escrow balance (₹${currentEscrow?.escrowBalance}) less than milestone amount (₹${milestoneAmount})`);
            }

            // 1. Release funds from Project Escrow
            const updatedEscrow = await tx.projectEscrow.update({
                where: { id: escrow.id },
                data: {
                    escrowBalance: { decrement: Math.min(escrow.escrowBalance, milestoneAmount) },
                    totalReleasedAmount: { increment: milestoneAmount },
                },
            });

            // 2. Credit Specialist's Personal Wallet
            const wallet = await tx.wallet.upsert({
                where: { userId: proUserId },
                update: {
                    totalAvailableBalance: { increment: milestoneAmount },
                    updatedBy: user.id,
                },
                create: {
                    userId: proUserId,
                    totalAvailableBalance: milestoneAmount,
                    createdBy: user.id,
                    updatedBy: user.id,
                },
            });

            // 3. Record Escrow Ledger Release Transaction
            await tx.projectEscrowTransaction.create({
                data: {
                    escrowId: escrow.id,
                    type: "MILESTONE_RELEASE",
                    amount: milestoneAmount,
                    milestoneId: milestone.id,
                    userId: proUserId,
                    description: `Milestone "${milestone.title}" approved. ₹${milestoneAmount} released from Escrow to specialist's personal wallet.`,
                    status: "COMPLETED",
                },
            });

            // 4. Update Milestone Status to PAID
            const updatedMilestone = await tx.milestone.update({
                where: { id: milestone.id },
                data: {
                    status: "PAID",
                    approvedAt: new Date(),
                    paidAt: new Date(),
                    version: { increment: 1 },
                },
            });

            // 5. Evaluate Project Phase Progression & Completion
            await ProjectStateMachine.evaluateProjectPhaseProgression(project.id, tx);

            // Check if all milestones across all project contracts are now completed
            const allContracts = await tx.contract.findMany({
                where: { award: { projectId: project.id } },
                include: { milestones: true },
            });

            const allMilestonesCompleted = allContracts.every((c) =>
                c.milestones.every((m) => m.status === "PAID" || m.id === milestone.id)
            );

            // Check if any open dispute exists
            const openDisputes = await tx.projectDispute.count({
                where: { escrowId: escrow.id, status: "OPEN" },
            });

            if (allMilestonesCompleted && allContracts.length > 0 && openDisputes === 0) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { status: "COMPLETED", availabilityStatus: "CLOSED" },
                });
                await tx.projectEscrow.update({
                    where: { id: escrow.id },
                    data: { status: "COMPLETED" },
                });
            }

            // 6. Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: null,
                    action: "MILESTONE_PAYMENT_RELEASED",
                    entityType: "MILESTONE",
                    entityId: milestone.id,
                    details: {
                        projectId: project.id,
                        milestoneId: milestone.id,
                        milestoneAmount,
                        releasedToUserId: proUserId,
                        remainingEscrowBalance: updatedEscrow.escrowBalance,
                    },
                },
            });

            return { updatedEscrow, wallet, updatedMilestone, allMilestonesCompleted };
        });

        // Real-time notifications
        emitToProject(project.id, "milestone:status_changed", {
            milestoneId: milestone.id,
            status: "PAID",
            role: award.role,
            amount: milestoneAmount,
        });

        emitToProject(project.id, "escrow:released", {
            milestoneId: milestone.id,
            amount: milestoneAmount,
            proUserId,
            remainingEscrowBalance: result.updatedEscrow.escrowBalance,
        });

        // Private notification to specialist's wallet
        emitToUser(proUserId, "wallet:credited", {
            amount: milestoneAmount,
            newBalance: result.wallet.totalAvailableBalance,
            projectTitle: project.title,
            milestoneTitle: milestone.title,
        });

        return result;
    }

    /**
     * Client Rejects Milestone Deliverable / Requests Revision
     */
    static async rejectMilestone(user, milestoneId, reason = "") {
        if (!reason || String(reason).trim().length === 0) {
            throw new Error("Revision instructions/reason must be provided when requesting revisions");
        }

        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: { include: { project: true } },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");

        const award = milestone.contract.award;
        const project = award.project;

        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can reject milestones");
        }

        if (milestone.status === "PAID") {
            throw new Error("Cannot request revision on an already approved and paid milestone");
        }

        const updated = await prisma.milestone.update({
            where: { id: milestone.id },
            data: {
                status: "REVISION_REQUIRED",
                notes: `Revision requested: ${reason}`,
                version: { increment: 1 },
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                adminId: null,
                action: "MILESTONE_REVISION_REQUESTED",
                entityType: "MILESTONE",
                entityId: milestone.id,
                details: {
                    projectId: project.id,
                    milestoneId: milestone.id,
                    reason,
                },
            },
        });

        emitToProject(project.id, "milestone:status_changed", {
            milestoneId: milestone.id,
            status: "REVISION_REQUIRED",
            role: award.role,
            notes: reason,
        });

        return updated;
    }

    /**
     * Raise a Dispute on a Milestone (Client or Specialist)
     */
    static async raiseDispute(user, projectId, milestoneId, data = {}) {
        const { reason, description, evidenceUrls = [] } = data;

        if (!reason) throw new Error("Dispute reason is required");

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                escrow: true,
                awards: {
                    include: {
                        bid: true,
                        contract: { include: { milestones: true } },
                    },
                },
            },
        });

        if (!project) throw new Error("Project not found");

        let escrow = project.escrow;
        if (!escrow) {
            escrow = await this.initializeOrUpdateProjectEscrow(projectId);
        }

        const isClient = project.clientId === user.id;
        const isSpecialist = project.awards.some(
            (a) =>
                a.bid?.professionalId === user.id ||
                a.bid?.architectId === user.id ||
                a.bid?.designerId === user.id ||
                a.bid?.contractorId === user.id
        );

        if (!isClient && !isSpecialist && user.role !== 0) {
            throw new Error("Unauthorized to raise dispute on this project");
        }

        let milestone = null;
        if (milestoneId) {
            milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
        }

        const disputedAmount = milestone ? Number(milestone.amount) : 0;
        const userRoleLabel = isClient ? "CLIENT" : "SPECIALIST";

        const dispute = await prisma.$transaction(async (tx) => {
            // 1. Create Dispute Record
            const createdDispute = await tx.projectDispute.create({
                data: {
                    escrowId: escrow.id,
                    milestoneId: milestoneId || null,
                    raisedById: user.id,
                    raisedByRole: userRoleLabel,
                    reason,
                    description: description || null,
                    evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
                    disputedAmount,
                    status: "OPEN",
                },
            });

            // 2. Lock Milestone Status
            if (milestoneId) {
                await tx.milestone.update({
                    where: { id: milestoneId },
                    data: { status: "DISPUTED", version: { increment: 1 } },
                });
            }

            // 3. Update Project Escrow Disputed Amount
            await tx.projectEscrow.update({
                where: { id: escrow.id },
                data: {
                    totalDisputedAmount: { increment: disputedAmount },
                    status: "DISPUTED",
                },
            });

            // 4. Log Ledger Hold
            await tx.projectEscrowTransaction.create({
                data: {
                    escrowId: escrow.id,
                    type: "DISPUTE_HOLD",
                    amount: disputedAmount,
                    milestoneId: milestoneId || null,
                    userId: user.id,
                    description: `Dispute raised by ${userRoleLabel}: ${reason}. Amount ₹${disputedAmount} locked in Escrow pending admin review.`,
                    status: "LOCKED",
                },
            });

            // 5. Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: null,
                    action: "DISPUTE_RAISED",
                    entityType: "DISPUTE",
                    entityId: createdDispute.id,
                    details: {
                        projectId,
                        milestoneId,
                        raisedBy: user.id,
                        role: userRoleLabel,
                        reason,
                    },
                },
            });

            return createdDispute;
        });

        emitToProject(projectId, "dispute:raised", {
            disputeId: dispute.id,
            milestoneId,
            reason,
            raisedByRole: userRoleLabel,
        });

        return dispute;
    }

    /**
     * Admin Dispute Resolution (Release to Pro, Refund to Client, or Split)
     */
    static async resolveDisputeByAdmin(adminUser, disputeId, resolutionData = {}) {
        if (adminUser.role !== 0 && adminUser.role !== 7) {
            throw new Error("Unauthorized: Only Admin can resolve project disputes");
        }

        const {
            decision, // "RELEASE_TO_PRO" | "REFUND_TO_CLIENT" | "SPLIT" | "REJECT"
            releaseAmountPro = 0,
            refundAmountClient = 0,
            adminNotes = "",
        } = resolutionData;

        if (!decision) throw new Error("Resolution decision is required");

        const dispute = await prisma.projectDispute.findUnique({
            where: { id: disputeId },
            include: {
                escrow: {
                    include: {
                        project: {
                            include: {
                                awards: {
                                    include: {
                                        contract: { include: { milestones: true } },
                                        bid: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!dispute) throw new Error("Dispute not found");
        if (dispute.status.startsWith("RESOLVED")) {
            throw new Error("This dispute has already been resolved");
        }

        const escrow = dispute.escrow;
        const project = escrow.project;
        const milestoneId = dispute.milestoneId;

        // Find relevant specialist
        let proUserId = null;
        if (milestoneId) {
            for (const award of project.awards) {
                if (award.contract?.milestones?.some((m) => m.id === milestoneId)) {
                    proUserId =
                        award.bid?.professionalId ||
                        award.bid?.architect?.userId ||
                        award.bid?.designer?.userId ||
                        award.bid?.contractor?.userId;
                    break;
                }
            }
        }

        const resolved = await prisma.$transaction(async (tx) => {
            const relPro = Number(releaseAmountPro) || 0;
            const refCli = Number(refundAmountClient) || 0;

            // 1. If releasing funds to Pro
            if (relPro > 0 && proUserId) {
                await tx.wallet.upsert({
                    where: { userId: proUserId },
                    update: { totalAvailableBalance: { increment: relPro } },
                    create: {
                        userId: proUserId,
                        totalAvailableBalance: relPro,
                        createdBy: adminUser.id,
                        updatedBy: adminUser.id,
                    },
                });

                await tx.projectEscrow.update({
                    where: { id: escrow.id },
                    data: {
                        escrowBalance: { decrement: Math.min(escrow.escrowBalance, relPro) },
                        totalReleasedAmount: { increment: relPro },
                    },
                });

                await tx.projectEscrowTransaction.create({
                    data: {
                        escrowId: escrow.id,
                        type: "DISPUTE_RELEASE_PRO",
                        amount: relPro,
                        milestoneId,
                        userId: proUserId,
                        description: `Admin resolved dispute #${disputeId.slice(0, 8)}: Released ₹${relPro} to specialist. Notes: ${adminNotes}`,
                        status: "COMPLETED",
                    },
                });
            }

            // 2. If refunding funds to Client
            if (refCli > 0) {
                await tx.projectEscrow.update({
                    where: { id: escrow.id },
                    data: {
                        escrowBalance: { decrement: Math.min(escrow.escrowBalance, refCli) },
                        totalRefundedAmount: { increment: refCli },
                    },
                });

                await tx.projectEscrowTransaction.create({
                    data: {
                        escrowId: escrow.id,
                        type: "DISPUTE_REFUND_CLIENT",
                        amount: refCli,
                        milestoneId,
                        userId: project.clientId,
                        description: `Admin resolved dispute #${disputeId.slice(0, 8)}: Refunded ₹${refCli} to client. Notes: ${adminNotes}`,
                        status: "COMPLETED",
                    },
                });
            }

            // 3. Clear Disputed Amount on Escrow
            await tx.projectEscrow.update({
                where: { id: escrow.id },
                data: {
                    totalDisputedAmount: { decrement: Math.min(escrow.totalDisputedAmount, dispute.disputedAmount) },
                    status: escrow.escrowBalance > 0 ? "FUNDED" : "COMPLETED",
                },
            });

            // 4. Update Milestone Status
            if (milestoneId) {
                await tx.milestone.update({
                    where: { id: milestoneId },
                    data: {
                        status: relPro > 0 ? "PAID" : "APPROVED",
                        notes: `Dispute resolved by Admin: ${decision}. ${adminNotes}`,
                        version: { increment: 1 },
                    },
                });
            }

            // 5. Update Dispute Record
            const statusMap = {
                RELEASE_TO_PRO: "RESOLVED_RELEASED",
                REFUND_TO_CLIENT: "RESOLVED_REFUNDED",
                SPLIT: "RESOLVED_SPLIT",
                REJECT: "REJECTED",
            };

            const updatedDispute = await tx.projectDispute.update({
                where: { id: disputeId },
                data: {
                    status: statusMap[decision] || "RESOLVED_RELEASED",
                    adminDecision: decision,
                    adminNotes,
                    resolvedById: adminUser.id,
                    releaseAmountPro: relPro,
                    refundAmountClient: refCli,
                    resolvedAt: new Date(),
                },
            });

            // 6. Log Audit Trail
            await tx.auditLog.create({
                data: {
                    adminId: adminUser.id,
                    action: "DISPUTE_RESOLVED",
                    entityType: "DISPUTE",
                    entityId: disputeId,
                    details: {
                        decision,
                        releaseAmountPro: relPro,
                        refundAmountClient: refCli,
                        adminNotes,
                    },
                },
            });

            return updatedDispute;
        });

        emitToProject(project.id, "dispute:resolved", {
            disputeId,
            decision,
            releaseAmountPro,
            refundAmountClient,
        });

        return resolved;
    }

    /**
     * Admin: Master Financial Overview & KPI Metrics
     */
    static async getAdminFinancialOverview() {
        const [
            totalEscrows,
            escrowAggregates,
            platformRevenueAgg,
            openDisputesCount,
            recentTransactions,
        ] = await Promise.all([
            prisma.projectEscrow.count(),
            prisma.projectEscrow.aggregate({
                _sum: {
                    totalProjectValue: true,
                    initialDepositPaid: true,
                    escrowBalance: true,
                    totalReleasedAmount: true,
                    totalRefundedAmount: true,
                    totalDisputedAmount: true,
                    platformFeeAmount: true,
                },
            }),
            prisma.platformRevenue.aggregate({
                _sum: { amount: true },
                _count: { id: true },
            }),
            prisma.projectDispute.count({
                where: { status: "OPEN" },
            }),
            prisma.projectEscrowTransaction.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    escrow: {
                        include: {
                            project: { select: { id: true, title: true } },
                        },
                    },
                    user: { select: { id: true, name: true, role: true } },
                },
            }),
        ]);

        return {
            totalEscrowAccounts: totalEscrows,
            totalProjectVolume: escrowAggregates._sum.totalProjectValue || 0,
            totalEscrowBalanceHeld: escrowAggregates._sum.escrowBalance || 0,
            totalReleasedToPros: escrowAggregates._sum.totalReleasedAmount || 0,
            totalRefundedToClients: escrowAggregates._sum.totalRefundedAmount || 0,
            totalDisputedLocked: escrowAggregates._sum.totalDisputedAmount || 0,
            totalPlatformRevenue5Percent: platformRevenueAgg._sum.amount || 0,
            platformFeeTransactionsCount: platformRevenueAgg._count.id || 0,
            openDisputesCount,
            recentTransactions,
        };
    }

    /**
     * Admin: List all Project Escrow Wallets
     */
    static async getAdminProjectEscrows(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const where = {};
        if (query.status) where.status = query.status;

        const [escrows, total] = await Promise.all([
            prisma.projectEscrow.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: "desc" },
                include: {
                    project: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            client: { select: { id: true, name: true, email: true } },
                        },
                    },
                    _count: {
                        select: { transactions: true, disputes: true },
                    },
                },
            }),
            prisma.projectEscrow.count({ where }),
        ]);

        return {
            escrows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Admin: List all Disputes
     */
    static async getAdminDisputes(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const where = {};
        if (query.status) where.status = query.status;

        const [disputes, total] = await Promise.all([
            prisma.projectDispute.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    raisedBy: { select: { id: true, name: true, email: true, role: true } },
                    resolvedBy: { select: { id: true, name: true, email: true } },
                    escrow: {
                        include: {
                            project: {
                                select: {
                                    id: true,
                                    title: true,
                                    client: { select: { id: true, name: true, email: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.projectDispute.count({ where }),
        ]);

        return {
            disputes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }
}

export default EscrowService;
