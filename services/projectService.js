import prisma from "../config/prismaClient.js";
import AuditService from "./auditService.js";

const VALID_TRANSITIONS = {
    DRAFT: ["WAITING_FOR_QUOTATIONS", "CANCELLED"],
    WAITING_FOR_QUOTATIONS: ["PROPOSALS_RECEIVED", "SELECTED", "HIRED", "CANCELLED"],
    PROPOSALS_RECEIVED: ["WAITING_FOR_QUOTATIONS", "SELECTED", "HIRED", "CANCELLED"],
    SELECTED: ["IN_PROGRESS", "PROPOSALS_RECEIVED", "CANCELLED"],
    HIRED: ["IN_PROGRESS", "PROPOSALS_RECEIVED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

class ProjectService {
    /**
     * Check if a state transition is valid
     */
    static canTransition(currentStatus, targetStatus) {
        if (currentStatus === targetStatus) return true;
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        return allowed.includes(targetStatus);
    }

    /**
     * Transition a project to a new status with validation and RBAC checks
     */
    static async transitionProjectStatus(projectId, targetStatus, userOrAdmin, reason = null, req = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: true },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = userOrAdmin.role === 0 || userOrAdmin.role === 7;
        const isClientOwner = project.clientId === userOrAdmin.id;

        if (!isAdmin && !isClientOwner) {
            throw new Error("Unauthorized to change project status");
        }

        if (!ProjectService.canTransition(project.status, targetStatus)) {
            throw new Error(
                `Invalid project status transition from ${project.status} to ${targetStatus}`
            );
        }

        const updated = await prisma.project.update({
            where: { id: projectId },
            data: {
                status: targetStatus,
                ...(targetStatus === "COMPLETED" || targetStatus === "CANCELLED"
                    ? { availabilityStatus: "CLOSED" }
                    : {}),
            },
            include: {
                teamMembers: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                    },
                },
                attachments: true,
            },
        });

        if (isAdmin) {
            await AuditService.logAction({
                adminId: userOrAdmin.id,
                action: "UPDATE_PROJECT_STATUS",
                entityType: "PROJECT",
                entityId: projectId,
                details: {
                    previousStatus: project.status,
                    newStatus: targetStatus,
                    reason,
                },
                req,
            });
        }

        return updated;
    }

    /**
     * Get project team members
     */
    static async getProjectTeam(projectId, userOrAdmin) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                teamMembers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                city: true,
                                state: true,
                                profile: true,
                            },
                        },
                        bid: true,
                    },
                    orderBy: { joinedAt: "asc" },
                },
            },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = userOrAdmin.role === 0 || userOrAdmin.role === 7;
        const isClientOwner = project.clientId === userOrAdmin.id;
        const isTeamMember = project.teamMembers.some((m) => m.userId === userOrAdmin.id);

        if (!isAdmin && !isClientOwner && !isTeamMember) {
            throw new Error("Unauthorized to view project team");
        }

        return project.teamMembers;
    }

    /**
     * Remove or complete a team member (Client or Admin)
     */
    static async removeTeamMember(projectId, memberId, userOrAdmin, reason = null, req = null) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: true },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = userOrAdmin.role === 0 || userOrAdmin.role === 7;
        const isClientOwner = project.clientId === userOrAdmin.id;

        if (!isAdmin && !isClientOwner) {
            throw new Error("Unauthorized to modify project team");
        }

        const member = await prisma.projectTeam.findFirst({
            where: { id: memberId, projectId },
        });

        if (!member) {
            throw new Error("Team member not found in project");
        }

        const updated = await prisma.$transaction(async (tx) => {
            const removed = await tx.projectTeam.update({
                where: { id: memberId },
                data: { status: "REMOVED" },
            });

            // If bid was attached, update bid status if necessary
            if (member.bidId) {
                await tx.bid.update({
                    where: { id: member.bidId },
                    data: { rejectionReason: reason || "Removed from project team" },
                });
            }

            // Check if any active team members remain
            const activeMembers = await tx.projectTeam.count({
                where: { projectId, status: "ACTIVE" },
            });

            if (activeMembers === 0 && project.status === "SELECTED") {
                await tx.project.update({
                    where: { id: projectId },
                    data: { status: "PROPOSALS_RECEIVED" },
                });
            }

            return removed;
        });

        if (isAdmin) {
            await AuditService.logAction({
                adminId: userOrAdmin.id,
                action: "REMOVE_PROJECT_TEAM_MEMBER",
                entityType: "PROJECT_TEAM",
                entityId: memberId,
                details: { projectId, removedUserId: member.userId, role: member.role, reason },
                req,
            });
        }

        return updated;
    }
}

export default ProjectService;
