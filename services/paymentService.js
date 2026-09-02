import crypto from "crypto";
import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";
import ProjectStateMachine from "./projectStateMachine.js";
import { emitToProject, emitToUser } from "../socket/socketServer.js";

class PaymentService {
    /**
     * Verify Razorpay Webhook Signature
     */
    static verifyWebhookSignature(rawBody, signature, secret) {
        if (!signature || !secret) return false;
        try {
            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("hex");
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature, "utf8"),
                Buffer.from(signature, "utf8")
            );
        } catch (err) {
            logger.error(`[PaymentService] Signature verification error: ${err.message}`);
            return false;
        }
    }

    /**
     * Start work on a milestone (Professional only)
     */
    static async startMilestone(user, milestoneId) {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: {
                                project: true,
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
        const bid = award.bid;
        const isOwner =
            bid.professionalId === user.id ||
            (bid.architect && bid.architect.userId === user.id) ||
            (bid.designer && bid.designer.userId === user.id) ||
            (bid.contractor && bid.contractor.userId === user.id);

        if (!isOwner && user.role !== 0) {
            throw new Error("Unauthorized: Only the assigned specialist can start this milestone");
        }

        const updated = await ProjectStateMachine.transitionMilestone(
            milestoneId,
            "IN_PROGRESS",
            milestone.version
        );

        emitToProject(award.projectId, "milestone:status_changed", {
            milestoneId: updated.id,
            status: updated.status,
            role: award.role,
        });

        return updated;
    }

    /**
     * Submit milestone for client review with proof photos / documents (Professional only)
     */
    static async submitMilestoneForReview(user, milestoneId, data = {}) {
        const { proofUrls = [], notes = "" } = data;

        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: {
                                project: true,
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
        const bid = award.bid;
        const isOwner =
            bid.professionalId === user.id ||
            (bid.architect && bid.architect.userId === user.id) ||
            (bid.designer && bid.designer.userId === user.id) ||
            (bid.contractor && bid.contractor.userId === user.id);

        if (!isOwner && user.role !== 0) {
            throw new Error("Unauthorized: Only the assigned specialist can submit milestone proof");
        }

        const updated = await ProjectStateMachine.transitionMilestone(
            milestoneId,
            "SUBMITTED_FOR_REVIEW",
            milestone.version,
            {
                proofUrls: Array.isArray(proofUrls) ? proofUrls : [],
                notes: notes ? String(notes).trim() : milestone.notes,
            }
        );

        emitToProject(award.projectId, "milestone:status_changed", {
            milestoneId: updated.id,
            status: updated.status,
            role: award.role,
        });

        return updated;
    }

    /**
     * Client approves milestone deliverables
     */
    static async approveMilestone(user, milestoneId) {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: { project: true },
                        },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");

        const project = milestone.contract.award.project;
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project owner can approve milestones");
        }

        const updated = await ProjectStateMachine.transitionMilestone(
            milestoneId,
            "APPROVED",
            milestone.version
        );

        emitToProject(project.id, "milestone:status_changed", {
            milestoneId: updated.id,
            status: updated.status,
            role: milestone.contract.award.role,
        });

        return updated;
    }

    /**
     * Client disputes milestone / requests revisions
     */
    static async disputeMilestone(user, milestoneId, reason = "") {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: { project: true },
                        },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");

        const project = milestone.contract.award.project;
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project owner can dispute milestones");
        }

        const updated = await ProjectStateMachine.transitionMilestone(
            milestoneId,
            "DISPUTED",
            milestone.version,
            { notes: reason ? `Dispute: ${reason}` : milestone.notes }
        );

        emitToProject(project.id, "milestone:status_changed", {
            milestoneId: updated.id,
            status: updated.status,
            role: milestone.contract.award.role,
        });

        return updated;
    }

    /**
     * Create Razorpay Payment Order for an approved milestone
     */
    static async createPaymentOrder(user, milestoneId, idempotencyKey = null) {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: {
                                project: true,
                                bid: {
                                    include: {
                                        architect: { include: { user: true } },
                                        designer: { include: { user: true } },
                                        contractor: { include: { user: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");

        const project = milestone.contract.award.project;
        if (project.clientId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the project client can pay for milestones");
        }

        if (milestone.status !== "APPROVED" && milestone.status !== "SUBMITTED_FOR_REVIEW") {
            throw new Error(`Milestone cannot be paid in status: ${milestone.status}`);
        }

        // Check if an existing payment with this idempotency key already exists
        if (idempotencyKey) {
            const existingPayment = await prisma.payment.findUnique({
                where: { idempotencyKey },
            });
            if (existingPayment && existingPayment.status === "CAPTURED") {
                return { payment: existingPayment, message: "Payment already captured" };
            }
            if (existingPayment) {
                return {
                    orderId: existingPayment.gatewayOrderId,
                    amount: existingPayment.amount,
                    currency: existingPayment.currency,
                    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_designconnect",
                    milestoneId,
                };
            }
        }

        // Generate Gateway Order ID
        const generatedOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const payment = await prisma.payment.create({
            data: {
                milestoneId,
                gateway: "RAZORPAY",
                gatewayOrderId: generatedOrderId,
                amount: milestone.amount,
                currency: "INR",
                status: "CREATED",
                idempotencyKey: idempotencyKey || `idemp_${Date.now()}_${milestoneId}`,
            },
        });

        return {
            paymentId: payment.id,
            orderId: payment.gatewayOrderId,
            amount: payment.amount,
            currency: payment.currency,
            keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_designconnect",
            milestoneId,
            projectTitle: project.title,
            milestoneTitle: milestone.title,
        };
    }

    /**
     * Process Razorpay Webhook Event (Idempotent & HMAC Verified)
     */
    static async handleRazorpayWebhook(rawBody, signature, payload) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "razorpay_webhook_secret_dc";

        // 1. Verify Signature
        const isValid = PaymentService.verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid && process.env.NODE_ENV === "production") {
            logger.error("[PaymentWebhook] Invalid webhook signature detected!");
            throw new Error("Invalid webhook signature");
        }

        const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;
        const eventName = payload.event || (payload.payment ? "payment.captured" : "unknown");

        // 2. Idempotency Check in webhook_events
        const existingEvent = await prisma.webhookEvent.findUnique({
            where: { eventId },
        });

        if (existingEvent) {
            logger.info(`[PaymentWebhook] Event ${eventId} already recorded, skipping processing`);
            return { success: true, duplicate: true };
        }

        // Record webhook event immediately
        await prisma.webhookEvent.create({
            data: {
                provider: "razorpay",
                eventId,
                payload: payload || {},
                status: "processing",
            },
        });

        // 3. Process Event State Transitions
        try {
            if (eventName === "payment.captured" || eventName === "order.paid") {
                const entity = payload.payload?.payment?.entity || payload.payment || {};
                const orderId = entity.order_id || payload.order_id;
                const gatewayPaymentId = entity.id || payload.payment_id;

                let payment = null;
                if (orderId) {
                    payment = await prisma.payment.findFirst({
                        where: { gatewayOrderId: orderId },
                        include: {
                            milestone: {
                                include: {
                                    contract: {
                                        include: {
                                            award: { include: { project: true } },
                                        },
                                    },
                                },
                            },
                        },
                    });
                }

                if (payment) {
                    await prisma.$transaction(async (tx) => {
                        // Mark payment captured
                        await tx.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: "CAPTURED",
                                gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId,
                                rawWebhookPayload: payload,
                            },
                        });

                        // Transition milestone to PAID
                        if (payment.milestone.status !== "PAID") {
                            await ProjectStateMachine.transitionMilestone(
                                payment.milestone.id,
                                "PAID",
                                payment.milestone.version,
                                {},
                                tx
                            );
                        }
                    });

                    const projectId = payment.milestone.contract.award.projectId;

                    // Emit real-time update to project room
                    emitToProject(projectId, "milestone:status_changed", {
                        milestoneId: payment.milestone.id,
                        status: "PAID",
                        role: payment.milestone.contract.award.role,
                    });

                    emitToProject(projectId, "payment:status_changed", {
                        paymentId: payment.id,
                        milestoneId: payment.milestone.id,
                        status: "CAPTURED",
                        amount: payment.amount,
                    });
                }
            } else if (eventName === "payment.failed") {
                const entity = payload.payload?.payment?.entity || payload.payment || {};
                const orderId = entity.order_id;
                if (orderId) {
                    await prisma.payment.updateMany({
                        where: { gatewayOrderId: orderId },
                        data: { status: "FAILED", rawWebhookPayload: payload },
                    });
                }
            }

            // Mark webhook event completed
            await prisma.webhookEvent.update({
                where: { eventId },
                data: { status: "completed", processedAt: new Date() },
            });

            return { success: true };
        } catch (procErr) {
            logger.error(`[PaymentWebhook] Error processing event ${eventId}: ${procErr.message}`);
            await prisma.webhookEvent.update({
                where: { eventId },
                data: { status: "error" },
            });
            throw procErr;
        }
    }

    /**
     * Get all contracts & milestones for a project
     */
    static async getProjectContractsAndMilestones(user, projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                awards: {
                    include: {
                        awardedBy: {
                            select: { id: true, name: true, email: true },
                        },
                        bid: {
                            include: {
                                professional: {
                                    select: { id: true, name: true, email: true, profile: true, ratingCache: true },
                                },
                                architect: { include: { user: true } },
                                designer: { include: { user: true } },
                                contractor: { include: { user: true } },
                            },
                        },
                        contract: {
                            include: {
                                milestones: {
                                    include: {
                                        payments: true,
                                    },
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
        const isAwardee = project.awards.some(
            (a) =>
                a.bid?.professionalId === user.id ||
                a.bid?.architect?.userId === user.id ||
                a.bid?.designer?.userId === user.id ||
                a.bid?.contractor?.userId === user.id
        );

        if (!isAdmin && !isClient && !isAwardee) {
            throw new Error("Unauthorized to view project contracts");
        }

        return {
            projectId: project.id,
            title: project.title,
            status: project.status,
            currentPhase: project.currentPhase,
            scope: project.scope,
            awards: project.awards,
        };
    }

    /**
     * Get payments for the current logged-in user (Client or Professional)
     */
    static async getMyPayments(user, query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const isClient = user.role === 1;

        const where = {};
        if (isClient) {
            where.milestone = {
                contract: {
                    award: {
                        projectId: { not: undefined },
                        project: { clientId: user.id },
                    },
                },
            };
        } else {
            where.milestone = {
                contract: {
                    award: {
                        bid: {
                            OR: [
                                { professionalId: user.id },
                                { architect: { userId: user.id } },
                                { designer: { userId: user.id } },
                                { contractor: { userId: user.id } },
                            ],
                        },
                    },
                },
            };
        }

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    milestone: {
                        include: {
                            contract: {
                                include: {
                                    award: {
                                        include: {
                                            project: { select: { id: true, title: true, clientId: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.payment.count({ where }),
        ]);

        return {
            payments,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }
}

export default PaymentService;
