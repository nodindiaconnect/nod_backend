import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

export class StaleStateError extends Error {
    constructor(message = "Stale state detected. The record has been modified by another operation.") {
        super(message);
        this.name = "StaleStateError";
        this.statusCode = 409;
    }
}

export class StateTransitionError extends Error {
    constructor(message = "Invalid state transition requested.") {
        super(message);
        this.name = "StateTransitionError";
        this.statusCode = 400;
    }
}

/**
 * State Machine Transition Tables
 */
export const PROJECT_TRANSITIONS = {
    DRAFT: ["PUBLISHED", "BIDDING_OPEN", "WAITING_FOR_QUOTATIONS", "CANCELLED"],
    PUBLISHED: ["BIDDING_OPEN", "WAITING_FOR_QUOTATIONS", "PROPOSALS_RECEIVED", "CANCELLED"],
    BIDDING_OPEN: ["ROLE_SELECTED", "SELECTED", "HIRED", "PAYMENT_REQUIRED", "CANCELLED", "PROPOSALS_RECEIVED"],
    WAITING_FOR_QUOTATIONS: ["PROPOSALS_RECEIVED", "BIDDING_OPEN", "ROLE_SELECTED", "SELECTED", "PAYMENT_REQUIRED", "CANCELLED"],
    PROPOSALS_RECEIVED: ["ROLE_SELECTED", "SELECTED", "HIRED", "PAYMENT_REQUIRED", "BIDDING_OPEN", "CANCELLED"],
    ROLE_SELECTED: ["PAYMENT_REQUIRED", "IN_PROGRESS_PLANNING", "IN_PROGRESS_CONSTRUCTION", "IN_PROGRESS_INTERIORS", "IN_PROGRESS", "CANCELLED"],
    SELECTED: ["PAYMENT_REQUIRED", "IN_PROGRESS_PLANNING", "IN_PROGRESS_CONSTRUCTION", "IN_PROGRESS_INTERIORS", "IN_PROGRESS", "CANCELLED"],
    HIRED: ["PAYMENT_REQUIRED", "IN_PROGRESS", "IN_PROGRESS_PLANNING", "CANCELLED"],
    PAYMENT_REQUIRED: ["IN_PROGRESS", "IN_PROGRESS_PLANNING", "CANCELLED"],
    IN_PROGRESS_PLANNING: ["IN_PROGRESS_CONSTRUCTION", "COMPLETED", "CANCELLED"],
    IN_PROGRESS_CONSTRUCTION: ["IN_PROGRESS_INTERIORS", "COMPLETED", "CANCELLED"],
    IN_PROGRESS_INTERIORS: ["COMPLETED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

export const BID_TRANSITIONS = {
    SUBMITTED: ["SHORTLISTED", "AWARDED", "ACCEPTED", "REJECTED", "WITHDRAWN"],
    PENDING: ["SHORTLISTED", "AWARDED", "ACCEPTED", "REJECTED", "WITHDRAWN"],
    SHORTLISTED: ["AWARDED", "ACCEPTED", "REJECTED", "WITHDRAWN", "SUBMITTED", "PENDING"],
    AWARDED: [],
    ACCEPTED: [],
    REJECTED: [],
    WITHDRAWN: [],
    EXPIRED: [],
};

export const MILESTONE_TRANSITIONS = {
    PENDING: ["IN_PROGRESS"],
    IN_PROGRESS: ["SUBMITTED_FOR_REVIEW"],
    SUBMITTED_FOR_REVIEW: ["APPROVED", "DISPUTED", "REVISION_REQUIRED", "PAID"],
    REVISION_REQUIRED: ["IN_PROGRESS", "SUBMITTED_FOR_REVIEW"],
    DISPUTED: ["IN_PROGRESS", "SUBMITTED_FOR_REVIEW", "APPROVED", "PAID"],
    APPROVED: ["PAID"],
    PAID: [],
};

export class ProjectStateMachine {
    /**
     * Verify if project transition is allowed
     */
    static canTransitionProject(currentStatus, targetStatus) {
        if (currentStatus === targetStatus) return true;
        const allowed = PROJECT_TRANSITIONS[currentStatus] || [];
        return allowed.includes(targetStatus);
    }

    /**
     * Transition Project Status with Optimistic Locking
     */
    static async transitionProject(projectId, targetStatus, expectedVersion, extraData = {}, tx = prisma) {
        const project = await tx.project.findUnique({
            where: { id: projectId },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        if (!this.canTransitionProject(project.status, targetStatus)) {
            throw new StateTransitionError(
                `Invalid project transition from ${project.status} to ${targetStatus}`
            );
        }

        const updateData = {
            status: targetStatus,
            version: { increment: 1 },
            ...extraData,
        };

        if (targetStatus === "COMPLETED" || targetStatus === "CANCELLED") {
            updateData.availabilityStatus = "CLOSED";
        }

        const whereCondition = { id: projectId };
        if (expectedVersion !== undefined && expectedVersion !== null) {
            whereCondition.version = expectedVersion;
        }

        const count = await tx.project.updateMany({
            where: whereCondition,
            data: updateData,
        });

        if (count.count === 0) {
            throw new StaleStateError("Project status was updated concurrently. Please refresh and retry.");
        }

        return tx.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: true, attachments: true, awards: true },
        });
    }

    /**
     * Transition Bid Status with Optimistic Locking
     */
    static async transitionBid(bidId, targetStatus, expectedVersion, extraData = {}, tx = prisma) {
        const bid = await tx.bid.findUnique({
            where: { id: bidId },
        });

        if (!bid) {
            throw new Error("Bid not found");
        }

        const allowed = BID_TRANSITIONS[bid.status] || [];
        if (bid.status !== targetStatus && !allowed.includes(targetStatus)) {
            throw new StateTransitionError(
                `Invalid bid transition from ${bid.status} to ${targetStatus}`
            );
        }

        const updateData = {
            status: targetStatus,
            version: { increment: 1 },
            ...extraData,
        };

        const whereCondition = { id: bidId };
        if (expectedVersion !== undefined && expectedVersion !== null) {
            whereCondition.version = expectedVersion;
        }

        const count = await tx.bid.updateMany({
            where: whereCondition,
            data: updateData,
        });

        if (count.count === 0) {
            throw new StaleStateError("Bid was updated concurrently. Please refresh.");
        }

        return tx.bid.findUnique({
            where: { id: bidId },
            include: { project: true },
        });
    }

    /**
     * Transition Milestone Status with Optimistic Locking
     */
    static async transitionMilestone(milestoneId, targetStatus, expectedVersion, extraData = {}, tx = prisma) {
        const milestone = await tx.milestone.findUnique({
            where: { id: milestoneId },
            include: { contract: { include: { award: { include: { project: true } } } } },
        });

        if (!milestone) {
            throw new Error("Milestone not found");
        }

        const allowed = MILESTONE_TRANSITIONS[milestone.status] || [];
        if (milestone.status !== targetStatus && !allowed.includes(targetStatus)) {
            throw new StateTransitionError(
                `Invalid milestone transition from ${milestone.status} to ${targetStatus}`
            );
        }

        const updateData = {
            status: targetStatus,
            version: { increment: 1 },
            ...extraData,
        };

        if (targetStatus === "SUBMITTED_FOR_REVIEW") {
            updateData.submittedAt = new Date();
        } else if (targetStatus === "APPROVED") {
            updateData.approvedAt = new Date();
        } else if (targetStatus === "PAID") {
            updateData.paidAt = new Date();
        }

        const whereCondition = { id: milestoneId };
        if (expectedVersion !== undefined && expectedVersion !== null) {
            whereCondition.version = expectedVersion;
        }

        const count = await tx.milestone.updateMany({
            where: whereCondition,
            data: updateData,
        });

        if (count.count === 0) {
            throw new StaleStateError("Milestone status was modified concurrently. Please refresh.");
        }

        const updated = await tx.milestone.findUnique({
            where: { id: milestoneId },
            include: { contract: { include: { award: true } } },
        });

        // Check if all milestones in contract are approved/paid to advance project phase
        if (targetStatus === "PAID" || targetStatus === "APPROVED") {
            await this.evaluateProjectPhaseProgression(milestone.contract.award.projectId, tx);
        }

        return updated;
    }

    /**
     * Evaluates whether all milestones for the current phase are completed,
     * and automatically advances the project phase:
     * Planning (Architect) -> Construction (Contractor) -> Interiors (Designer) -> Completed
     */
    static async evaluateProjectPhaseProgression(projectId, tx = prisma) {
        const project = await tx.project.findUnique({
            where: { id: projectId },
            include: {
                awards: {
                    include: {
                        contract: {
                            include: { milestones: true },
                        },
                    },
                },
            },
        });

        if (!project || project.status === "COMPLETED" || project.status === "CANCELLED") {
            return;
        }

        const archAward = project.awards.find((a) => a.role === "ARCHITECT");
        const contAward = project.awards.find((a) => a.role === "CONTRACTOR");
        const desAward = project.awards.find((a) => a.role === "INTERIOR_DESIGNER");

        const isAwardComplete = (award) => {
            if (!award || !award.contract) return false;
            const ms = award.contract.milestones;
            return ms.length > 0 && ms.every((m) => m.status === "PAID" || m.status === "APPROVED");
        };

        let nextPhase = project.currentPhase;
        let nextStatus = project.status;

        if (project.scope === "FULL_PROJECT") {
            if (!project.currentPhase || project.currentPhase === "PLANNING") {
                if (isAwardComplete(archAward)) {
                    nextPhase = "CONSTRUCTION";
                    nextStatus = "IN_PROGRESS_CONSTRUCTION";
                } else {
                    nextPhase = "PLANNING";
                    nextStatus = "IN_PROGRESS_PLANNING";
                }
            }
            if (nextPhase === "CONSTRUCTION") {
                if (isAwardComplete(contAward)) {
                    nextPhase = "INTERIORS";
                    nextStatus = "IN_PROGRESS_INTERIORS";
                }
            }
            if (nextPhase === "INTERIORS") {
                if (isAwardComplete(desAward)) {
                    nextPhase = null;
                    nextStatus = "COMPLETED";
                }
            }
        } else if (project.scope === "ARCHITECTURE_ONLY") {
            nextPhase = "PLANNING";
            if (isAwardComplete(archAward)) {
                nextPhase = null;
                nextStatus = "COMPLETED";
            } else {
                nextStatus = "IN_PROGRESS_PLANNING";
            }
        } else if (project.scope === "CONSTRUCTION_ONLY") {
            nextPhase = "CONSTRUCTION";
            if (isAwardComplete(contAward)) {
                nextPhase = null;
                nextStatus = "COMPLETED";
            } else {
                nextStatus = "IN_PROGRESS_CONSTRUCTION";
            }
        } else if (project.scope === "DESIGN_ONLY") {
            nextPhase = "INTERIORS";
            if (isAwardComplete(desAward)) {
                nextPhase = null;
                nextStatus = "COMPLETED";
            } else {
                nextStatus = "IN_PROGRESS_INTERIORS";
            }
        }

        if (nextPhase !== project.currentPhase || nextStatus !== project.status) {
            await tx.project.update({
                where: { id: projectId },
                data: {
                    currentPhase: nextPhase,
                    status: nextStatus,
                    version: { increment: 1 },
                    ...(nextStatus === "COMPLETED" ? { availabilityStatus: "CLOSED" } : {}),
                },
            });
            logger.info(`[StateMachine] Project ${projectId} progressed to phase: ${nextPhase}, status: ${nextStatus}`);
        }
    }
}

export default ProjectStateMachine;
