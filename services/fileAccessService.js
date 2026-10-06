import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";

class FileAccessService {
    /**
     * Compute and enforce dynamic file permissions based on project lifecycle state
     */
    static computePermissions(project, user) {
        const isClient = project.clientId === user.id;
        const isAdmin = user.role === 0 || user.role === 7;
        const isCompleted = project.status === "COMPLETED";

        // Admin has full management override
        if (isAdmin) {
            return {
                canView: true,
                canDownload: true,
                canEdit: true,
                canAccessSource: true,
                canPrint: true,
                canShare: true,
                watermarkRequired: false,
                reason: "ADMIN_OVERRIDE",
            };
        }

        // Before project is fully completed: View-Only mode
        if (!isCompleted) {
            return {
                canView: true,
                canDownload: false,
                canEdit: false,
                canAccessSource: false,
                canPrint: false,
                canShare: false,
                watermarkRequired: true,
                watermarkText: `NOD | Project: ${project.title || project.id} | VIEW ONLY | CONFIDENTIAL`,
                reason: "PROJECT_IN_PROGRESS_RESTRICTED",
            };
        }

        // Project completed: Full access unlocked
        return {
            canView: true,
            canDownload: true,
            canEdit: false,
            canAccessSource: true,
            canPrint: true,
            canShare: true,
            watermarkRequired: false,
            reason: "PROJECT_COMPLETED_UNLOCKED",
        };
    }

    /**
     * Designer submits work / deliverables for a milestone
     */
    static async createSubmission(user, projectId, milestoneId, data = {}) {
        const { title = "Milestone Deliverables", notes = "", files = [] } = data;

        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                contract: {
                    include: {
                        award: {
                            include: {
                                project: true,
                                bid: true,
                            },
                        },
                    },
                },
            },
        });

        if (!milestone) throw new Error("Milestone not found");
        const award = milestone.contract.award;
        const project = award.project;

        // Authorization check: User must be the assigned specialist for this award
        const bid = award.bid;
        const proUserId =
            bid.professionalId ||
            bid.architect?.userId ||
            bid.designer?.userId ||
            bid.contractor?.userId;

        if (proUserId !== user.id && user.role !== 0) {
            throw new Error("Unauthorized: Only the assigned specialist can submit milestone deliverables.");
        }

        if (milestone.status === "APPROVED" || milestone.status === "PAID") {
            throw new Error("Milestone is already approved. Cannot submit new deliverables.");
        }

        return await prisma.$transaction(async (tx) => {
            // Count previous submissions for versioning
            const prevSubmissionsCount = await tx.projectSubmission.count({
                where: { milestoneId },
            });

            const version = prevSubmissionsCount + 1;

            const submission = await tx.projectSubmission.create({
                data: {
                    projectId,
                    milestoneId,
                    designerId: user.id,
                    version,
                    title: String(title).trim(),
                    notes: notes ? String(notes).trim() : null,
                    status: "SUBMITTED",
                    files: {
                        create: files.map((f) => ({
                            fileUrl: f.url || f.fileUrl,
                            fileName: f.name || f.fileName || `Deliverable_v${version}`,
                            fileType: f.type || f.fileType || "application/octet-stream",
                            fileSize: f.size ? Number(f.size) : null,
                            canView: true,
                            canDownload: false,
                            canAccessSource: false,
                            canPrint: false,
                            canShare: false,
                        })),
                    },
                },
                include: { files: true },
            });

            // Update Milestone state to SUBMITTED_FOR_REVIEW
            await tx.milestone.update({
                where: { id: milestoneId },
                data: {
                    status: "SUBMITTED_FOR_REVIEW",
                    submittedAt: new Date(),
                    designerRespondedAt: new Date(),
                    proofUrls: files.map((f) => f.url || f.fileUrl),
                },
            });

            // Log Audit
            await tx.auditLog.create({
                data: {
                    adminId: null,
                    action: "SUBMISSION_UPLOADED",
                    entityType: "PROJECT_SUBMISSION",
                    entityId: submission.id,
                    details: {
                        projectId,
                        milestoneId,
                        version,
                        filesCount: files.length,
                    },
                },
            });

            return submission;
        });
    }

    /**
     * Authorize and fetch file access permissions
     */
    static async getFileAccess(user, fileId) {
        const file = await prisma.submissionFile.findUnique({
            where: { id: fileId },
            include: {
                submission: {
                    include: {
                        project: {
                            include: {
                                client: true,
                                awards: { include: { bid: true } },
                            },
                        },
                        milestone: true,
                    },
                },
            },
        });

        if (!file) throw new Error("File not found");

        const project = file.submission.project;
        const isClient = project.clientId === user.id;
        const isAdmin = user.role === 0 || user.role === 7;

        let isAssignedSpecialist = false;
        for (const award of project.awards) {
            const b = award.bid;
            const proId = b?.professionalId || b?.architect?.userId || b?.designer?.userId || b?.contractor?.userId;
            if (proId === user.id) {
                isAssignedSpecialist = true;
                break;
            }
        }

        if (!isClient && !isAdmin && !isAssignedSpecialist) {
            throw new Error("Unauthorized: You do not have permission to view or access this project's files.");
        }

        const permissions = FileAccessService.computePermissions(project, user);

        return {
            fileId: file.id,
            fileName: file.fileName,
            fileType: file.fileType,
            fileUrl: file.fileUrl,
            projectStatus: project.status,
            permissions,
        };
    }
}

export default FileAccessService;
