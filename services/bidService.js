import prisma from "../config/prismaClient.js";
import sanitizeData from "../utils/sanitizeHtml.js";
import ChatService from "./chatService.js";

const ROLE_TO_SERVICE_TYPE = {
    2: "INTERIOR_DESIGNER",
    3: "ARCHITECT",
    4: "CONTRACTOR",
};

const SERVICE_TYPE_TO_ROLE = {
    INTERIOR_DESIGNER: 2,
    ARCHITECT: 3,
    CONTRACTOR: 4,
};

class BidService {
    /**
     * Resolve professional profile and ID based on user role
     */
    static async getProfessionalProfile(userId, role) {
        if (role === 2) {
            const designer = await prisma.designer.findUnique({ where: { userId } });
            if (!designer) throw new Error("Designer profile not found. Please complete profile registration.");
            return { profileId: designer.id, roleField: "designerId", serviceType: "INTERIOR_DESIGNER" };
        } else if (role === 3) {
            const architect = await prisma.architect.findUnique({ where: { userId } });
            if (!architect) throw new Error("Architect profile not found. Please complete profile registration.");
            return { profileId: architect.id, roleField: "architectId", serviceType: "ARCHITECT" };
        } else if (role === 4) {
            const contractor = await prisma.contractor.findUnique({ where: { userId } });
            if (!contractor) throw new Error("Contractor profile not found. Please complete profile registration.");
            return { profileId: contractor.id, roleField: "contractorId", serviceType: "CONTRACTOR" };
        }
        throw new Error("Only registered professionals (Architect, Designer, Contractor) can submit bids");
    }

    /**
     * Create a new bid on a project
     */
    static async createBid(user, projectId, bidData) {
        const { quotedPrice, amount, proposedDuration, proposal, portfolioLink, validUntil } = bidData;
        const finalPrice = Number(quotedPrice || amount);

        if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
            throw new Error("Quoted price must be a valid positive number");
        }

        if (!proposedDuration || String(proposedDuration).trim().length === 0) {
            throw new Error("Proposed duration is required");
        }

        if (!proposal || String(proposal).trim().length < 10) {
            throw new Error("Proposal description must be at least 10 characters");
        }

        // 1. Fetch Project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { teamMembers: { where: { status: "ACTIVE" } } },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        if (project.availabilityStatus !== "OPEN") {
            throw new Error("Project is closed for bidding");
        }

        if (!["WAITING_FOR_QUOTATIONS", "PROPOSALS_RECEIVED"].includes(project.status)) {
            throw new Error(`Project is in ${project.status} state and cannot accept new bids`);
        }

        const now = new Date();
        if (project.biddingDeadline && new Date(project.biddingDeadline) < now) {
            throw new Error("Project bidding deadline has expired");
        }

        // 2. Validate Professional Role & Match Project Requirements
        const { profileId, roleField, serviceType } = await BidService.getProfessionalProfile(user.id, user.role);

        if (!project.servicesRequired.includes(serviceType)) {
            throw new Error(
                `Project does not require ${serviceType.replace(/_/g, " ")}. Required services: ${project.servicesRequired.join(", ")}`
            );
        }

        // Check if category is already filled
        const alreadyFilled = project.teamMembers.some((m) => m.role === serviceType);
        if (alreadyFilled) {
            throw new Error(`A professional has already been selected for ${serviceType.replace(/_/g, " ")} on this project`);
        }

        // 3. Prevent duplicate active bids
        const existingActiveBid = await prisma.bid.findFirst({
            where: {
                projectId,
                [roleField]: profileId,
                status: { in: ["PENDING", "SHORTLISTED"] },
            },
        });

        if (existingActiveBid) {
            throw new Error("You have already submitted an active bid for this project. You can edit your existing bid instead.");
        }

        const sanitizedProposal = sanitizeData(String(proposal).trim());
        const cleanPortfolio = portfolioLink ? sanitizeData(String(portfolioLink).trim()) : null;

        // 4. Create Bid and update stats atomically
        const newBid = await prisma.$transaction(async (tx) => {
            const created = await tx.bid.create({
                data: {
                    projectId,
                    [roleField]: profileId,
                    role: serviceType,
                    amount: finalPrice,
                    quotedPrice: finalPrice,
                    proposedDuration: String(proposedDuration).trim(),
                    proposal: sanitizedProposal,
                    portfolioLink: cleanPortfolio,
                    validUntil: validUntil ? new Date(validUntil) : null,
                    status: "PENDING",
                },
                include: {
                    project: {
                        select: { id: true, title: true, category: true, status: true },
                    },
                },
            });

            // Update professional stats
            if (user.role === 2) {
                await tx.designer.update({
                    where: { id: profileId },
                    data: {
                        // totalQuotationsSent / quotationsPending if fields exist
                    },
                });
            } else if (user.role === 3) {
                await tx.architect.update({
                    where: { id: profileId },
                    data: {
                        totalQuotationsSent: { increment: 1 },
                        quotationsPending: { increment: 1 },
                    },
                });
            } else if (user.role === 4) {
                await tx.contractor.update({
                    where: { id: profileId },
                    data: {
                        totalQuotationsSent: { increment: 1 },
                        quotationsPending: { increment: 1 },
                    },
                });
            }

            // Update project status if first bid
            if (project.status === "WAITING_FOR_QUOTATIONS") {
                await tx.project.update({
                    where: { id: projectId },
                    data: { status: "PROPOSALS_RECEIVED" },
                });
            }

            return created;
        });

        return newBid;
    }

    /**
     * Update an existing bid (Owner only, while PENDING or SHORTLISTED)
     */
    static async updateBid(user, bidId, updateData) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: true,
                architect: true,
                designer: true,
                contractor: true,
            },
        });

        if (!bid) throw new Error("Bid not found");

        // Verify ownership
        const isOwner =
            (bid.architect && bid.architect.userId === user.id) ||
            (bid.designer && bid.designer.userId === user.id) ||
            (bid.contractor && bid.contractor.userId === user.id);

        if (!isOwner && user.role !== 0 && user.role !== 7) {
            throw new Error("Unauthorized: You can only edit your own bids");
        }

        if (!["PENDING", "SHORTLISTED"].includes(bid.status)) {
            throw new Error(`Cannot edit bid with status ${bid.status}`);
        }

        if (bid.project.availabilityStatus !== "OPEN") {
            throw new Error("Cannot edit bid for a closed project");
        }

        const data = {};
        if (updateData.quotedPrice !== undefined || updateData.amount !== undefined) {
            const price = Number(updateData.quotedPrice || updateData.amount);
            if (isNaN(price) || price <= 0) throw new Error("Price must be a valid positive number");
            data.amount = price;
            data.quotedPrice = price;
        }

        if (updateData.proposedDuration !== undefined) {
            data.proposedDuration = String(updateData.proposedDuration).trim();
        }

        if (updateData.proposal !== undefined) {
            if (String(updateData.proposal).trim().length < 10) {
                throw new Error("Proposal must be at least 10 characters");
            }
            data.proposal = sanitizeData(String(updateData.proposal).trim());
        }

        if (updateData.portfolioLink !== undefined) {
            data.portfolioLink = updateData.portfolioLink ? sanitizeData(String(updateData.portfolioLink).trim()) : null;
        }

        if (updateData.validUntil !== undefined) {
            data.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null;
        }

        const updated = await prisma.bid.update({
            where: { id: bidId },
            data,
            include: { project: true },
        });

        return updated;
    }

    /**
     * Withdraw a bid (Owner only, while PENDING or SHORTLISTED)
     */
    static async withdrawBid(user, bidId) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: true,
                architect: true,
                designer: true,
                contractor: true,
            },
        });

        if (!bid) throw new Error("Bid not found");

        const isOwner =
            (bid.architect && bid.architect.userId === user.id) ||
            (bid.designer && bid.designer.userId === user.id) ||
            (bid.contractor && bid.contractor.userId === user.id);

        if (!isOwner && user.role !== 0 && user.role !== 7) {
            throw new Error("Unauthorized: You can only withdraw your own bids");
        }

        if (!["PENDING", "SHORTLISTED"].includes(bid.status)) {
            throw new Error(`Cannot withdraw bid with status ${bid.status}`);
        }

        const updated = await prisma.$transaction(async (tx) => {
            const withdrawn = await tx.bid.update({
                where: { id: bidId },
                data: { status: "WITHDRAWN" },
            });

            if (bid.architectId) {
                await tx.architect.update({
                    where: { id: bid.architectId },
                    data: { quotationsPending: { decrement: 1 } },
                });
            } else if (bid.contractorId) {
                await tx.contractor.update({
                    where: { id: bid.contractorId },
                    data: { quotationsPending: { decrement: 1 } },
                });
            }

            // Check remaining active bids
            const remainingActive = await tx.bid.count({
                where: {
                    projectId: bid.projectId,
                    status: { in: ["PENDING", "SHORTLISTED"] },
                },
            });

            if (remainingActive === 0 && bid.project.status === "PROPOSALS_RECEIVED") {
                await tx.project.update({
                    where: { id: bid.projectId },
                    data: { status: "WAITING_FOR_QUOTATIONS" },
                });
            }

            return withdrawn;
        });

        return updated;
    }

    /**
     * Shortlist or unshortlist a bid (Project Owner Client only)
     */
    static async shortlistBid(clientId, bidId, isShortlisted = true) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: { project: true },
        });

        if (!bid) throw new Error("Bid not found");

        if (bid.project.clientId !== clientId) {
            throw new Error("Unauthorized: Only the project owner can shortlist bids");
        }

        if (!["PENDING", "SHORTLISTED"].includes(bid.status)) {
            throw new Error(`Cannot shortlist bid with status ${bid.status}`);
        }

        const updated = await prisma.bid.update({
            where: { id: bidId },
            data: {
                isShortlisted,
                status: isShortlisted ? "SHORTLISTED" : "PENDING",
            },
        });

        return updated;
    }

    /**
     * Accept a bid (Project Owner Client only)
     * - Marks bid as ACCEPTED
     * - Enforces 1 professional per required category
     * - Creates ProjectTeam record
     * - Rejects competing pending bids in the same category
     * - Updates professional and project statistics
     * - Enables project team chat
     */
    static async acceptBid(clientId, bidId, req = null) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: {
                    include: {
                        teamMembers: { where: { status: "ACTIVE" } },
                    },
                },
                architect: { include: { user: true } },
                designer: { include: { user: true } },
                contractor: { include: { user: true } },
            },
        });

        if (!bid) throw new Error("Bid not found");

        const project = bid.project;
        if (project.clientId !== clientId) {
            throw new Error("Unauthorized: Only the project owner can accept bids");
        }

        if (project.availabilityStatus !== "OPEN") {
            throw new Error("Cannot accept bids for a closed project");
        }

        if (!["PENDING", "SHORTLISTED"].includes(bid.status)) {
            throw new Error(`Cannot accept bid with status ${bid.status}`);
        }

        // Determine professional user ID and ServiceType
        let proUserId = null;
        let serviceType = bid.role;

        if (bid.architect) {
            proUserId = bid.architect.userId;
            serviceType = serviceType || "ARCHITECT";
        } else if (bid.designer) {
            proUserId = bid.designer.userId;
            serviceType = serviceType || "INTERIOR_DESIGNER";
        } else if (bid.contractor) {
            proUserId = bid.contractor.userId;
            serviceType = serviceType || "CONTRACTOR";
        }

        if (!proUserId || !serviceType) {
            throw new Error("Unable to identify professional for this bid");
        }

        // Check if category is already filled
        const alreadyFilled = project.teamMembers.find((m) => m.role === serviceType);
        if (alreadyFilled) {
            throw new Error(
                `A professional for ${serviceType.replace(/_/g, " ")} has already been accepted for this project`
            );
        }

        // Perform multi-step transactional acceptance
        const result = await prisma.$transaction(async (tx) => {
            // 1. Accept chosen bid
            const acceptedBid = await tx.bid.update({
                where: { id: bidId },
                data: { status: "ACCEPTED" },
            });

            // 2. Reject competing pending/shortlisted bids for the same project & role
            const competingWhere = {
                projectId: project.id,
                id: { not: bidId },
                status: { in: ["PENDING", "SHORTLISTED"] },
            };

            if (bid.architectId) competingWhere.architectId = { not: null };
            else if (bid.designerId) competingWhere.designerId = { not: null };
            else if (bid.contractorId) competingWhere.contractorId = { not: null };

            const competingBids = await tx.bid.findMany({ where: competingWhere });

            if (competingBids.length > 0) {
                await tx.bid.updateMany({
                    where: { id: { in: competingBids.map((b) => b.id) } },
                    data: {
                        status: "REJECTED",
                        rejectionReason: `Another proposal was accepted for ${serviceType.replace(/_/g, " ")}`,
                    },
                });

                // Update competing professionals' counters
                for (const comp of competingBids) {
                    if (comp.architectId) {
                        await tx.architect.update({
                            where: { id: comp.architectId },
                            data: {
                                quotationsPending: { decrement: 1 },
                                quotationsRejected: { increment: 1 },
                            },
                        });
                    } else if (comp.contractorId) {
                        await tx.contractor.update({
                            where: { id: comp.contractorId },
                            data: {
                                quotationsPending: { decrement: 1 },
                                quotationsRejected: { increment: 1 },
                            },
                        });
                    }
                }
            }

            // 3. Create ProjectTeam member
            const teamMember = await tx.projectTeam.create({
                data: {
                    projectId: project.id,
                    userId: proUserId,
                    role: serviceType,
                    bidId: bid.id,
                    status: "ACTIVE",
                },
            });

            // 4. Update accepted professional's counters
            if (bid.architectId) {
                await tx.architect.update({
                    where: { id: bid.architectId },
                    data: {
                        quotationsPending: { decrement: 1 },
                        quotationsAccepted: { increment: 1 },
                        projectsInProgress: { increment: 1 },
                        totalProjectsHandled: { increment: 1 },
                    },
                });
            } else if (bid.contractorId) {
                await tx.contractor.update({
                    where: { id: bid.contractorId },
                    data: {
                        quotationsPending: { decrement: 1 },
                        quotationsAccepted: { increment: 1 },
                        projectsInProgress: { increment: 1 },
                        totalProjectsHandled: { increment: 1 },
                    },
                });
            }

            // 5. Update Project status if all required categories are filled
            const activeTeamCount = project.teamMembers.length + 1; // including new member
            const requiredCount = project.servicesRequired.length;
            const allRolesFilled = activeTeamCount >= requiredCount;

            const nextStatus = allRolesFilled ? "SELECTED" : "PROPOSALS_RECEIVED";

            const updatedProject = await tx.project.update({
                where: { id: project.id },
                data: {
                    status: nextStatus,
                },
                include: { teamMembers: true },
            });

            return { acceptedBid, teamMember, project: updatedProject };
        });

        // 6. Automatically ensure Project Team Chat and Direct Chat exist
        try {
            await ChatService.getOrCreateDirectChat(project.id, clientId, proUserId, bid.id);
            await ChatService.getOrCreateProjectTeamChat(project.id, clientId);
        } catch (chatErr) {
            console.error("Auto-chat enablement non-fatal error:", chatErr);
        }

        return result;
    }

    /**
     * Reject a single bid with reason
     */
    static async rejectBid(clientId, bidId, reason = null) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: { project: true },
        });

        if (!bid) throw new Error("Bid not found");

        if (bid.project.clientId !== clientId) {
            throw new Error("Unauthorized: Only the project owner can reject bids");
        }

        if (!["PENDING", "SHORTLISTED"].includes(bid.status)) {
            throw new Error(`Cannot reject bid with status ${bid.status}`);
        }

        const sanitizedReason = reason ? sanitizeData(String(reason).trim()) : "Proposal rejected by client";

        const updated = await prisma.$transaction(async (tx) => {
            const rejected = await tx.bid.update({
                where: { id: bidId },
                data: {
                    status: "REJECTED",
                    rejectionReason: sanitizedReason,
                },
            });

            if (bid.architectId) {
                await tx.architect.update({
                    where: { id: bid.architectId },
                    data: {
                        quotationsPending: { decrement: 1 },
                        quotationsRejected: { increment: 1 },
                    },
                });
            } else if (bid.contractorId) {
                await tx.contractor.update({
                    where: { id: bid.contractorId },
                    data: {
                        quotationsPending: { decrement: 1 },
                        quotationsRejected: { increment: 1 },
                    },
                });
            }

            return rejected;
        });

        return updated;
    }

    /**
     * Get all bids for a project (Client Owner or Admin)
     * Grouped by category
     */
    static async getBidsForProject(user, projectId, query = {}) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project || project.isDeleted) {
            throw new Error("Project not found");
        }

        const isAdmin = user.role === 0 || user.role === 7;
        const isClientOwner = project.clientId === user.id;

        if (!isAdmin && !isClientOwner) {
            throw new Error("Unauthorized to view project bids");
        }

        const where = { projectId };
        if (query.status) where.status = query.status;

        const bids = await prisma.bid.findMany({
            where,
            include: {
                architect: {
                    include: {
                        user: {
                            select: { id: true, name: true, username: true, email: true, phone: true, profile: true, city: true, state: true },
                        },
                    },
                },
                designer: {
                    include: {
                        user: {
                            select: { id: true, name: true, username: true, email: true, phone: true, profile: true, city: true, state: true },
                        },
                    },
                },
                contractor: {
                    include: {
                        user: {
                            select: { id: true, name: true, username: true, email: true, phone: true, profile: true, city: true, state: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const grouped = {
            total: bids.length,
            architects: bids.filter((b) => b.architectId !== null || b.role === "ARCHITECT"),
            designers: bids.filter((b) => b.designerId !== null || b.role === "INTERIOR_DESIGNER"),
            contractors: bids.filter((b) => b.contractorId !== null || b.role === "CONTRACTOR"),
            all: bids,
        };

        return grouped;
    }

    /**
     * Get bids submitted by the logged-in professional
     */
    static async getMyBids(user, query = {}) {
        const { profileId, roleField } = await BidService.getProfessionalProfile(user.id, user.role);

        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const where = { [roleField]: profileId };
        if (query.status) where.status = query.status;

        const [bids, total] = await Promise.all([
            prisma.bid.findMany({
                where,
                include: {
                    project: {
                        select: {
                            id: true,
                            title: true,
                            category: true,
                            servicesRequired: true,
                            city: true,
                            state: true,
                            status: true,
                            availabilityStatus: true,
                            budgetMin: true,
                            budgetMax: true,
                            startDate: true,
                            completionDate: true,
                            biddingDeadline: true,
                            client: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.bid.count({ where }),
        ]);

        return {
            bids,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Get single bid by ID with RBAC check
     */
    static async getBidById(user, bidId) {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: {
                    include: {
                        client: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                        attachments: true,
                    },
                },
                architect: { include: { user: true } },
                designer: { include: { user: true } },
                contractor: { include: { user: true } },
                projectTeam: true,
            },
        });

        if (!bid) throw new Error("Bid not found");

        const isAdmin = user.role === 0 || user.role === 7;
        const isClientOwner = bid.project.clientId === user.id;
        const isBidder =
            (bid.architect && bid.architect.userId === user.id) ||
            (bid.designer && bid.designer.userId === user.id) ||
            (bid.contractor && bid.contractor.userId === user.id);

        if (!isAdmin && !isClientOwner && !isBidder) {
            throw new Error("Unauthorized to view this bid");
        }

        return bid;
    }
}

export default BidService;
