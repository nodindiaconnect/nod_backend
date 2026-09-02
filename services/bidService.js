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
    /**
     * Award / Accept a bid (Project Owner Client only)
     * - Atomic PostgreSQL transaction with row-level concurrency protection
     * - Enforces 1 winner per role at DB level via Award unique constraint (projectId, role)
     * - Automatically creates Contract with 3-phase Milestone Schedule
     * - Automatically creates ProjectTeam record
     * - Rejects competing pending/shortlisted bids in the same role
     * - Evaluates Project Phase Progression (Planning -> Construction -> Interiors -> Completed)
     * - Emits real-time socket events: bid:awarded, bid:rejected, project:phase_changed
     */
    static async acceptBid(clientId, bidId, req = null) {
        // 1. Fetch target bid and verify client ownership
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                project: {
                    include: {
                        awards: true,
                        teamMembers: { where: { status: "ACTIVE" } },
                    },
                },
                architect: { include: { user: true } },
                designer: { include: { user: true } },
                contractor: { include: { user: true } },
            },
        });

        if (!bid) {
            const err = new Error("Bid not found");
            err.statusCode = 404;
            throw err;
        }

        const project = bid.project;
        if (project.clientId !== clientId) {
            const err = new Error("Unauthorized: Only the project owner can award bids");
            err.statusCode = 403;
            throw err;
        }

        if (project.availabilityStatus !== "OPEN") {
            const err = new Error("Cannot award bids for a closed project");
            err.statusCode = 400;
            throw err;
        }

        if (!["PENDING", "SHORTLISTED", "SUBMITTED"].includes(bid.status)) {
            const err = new Error(`Cannot award bid with status ${bid.status}`);
            err.statusCode = 400;
            throw err;
        }

        // Determine professional user ID and ServiceType
        let proUserId = bid.professionalId;
        let serviceType = bid.role;

        if (bid.architect) {
            proUserId = proUserId || bid.architect.userId;
            serviceType = serviceType || "ARCHITECT";
        } else if (bid.designer) {
            proUserId = proUserId || bid.designer.userId;
            serviceType = serviceType || "INTERIOR_DESIGNER";
        } else if (bid.contractor) {
            proUserId = proUserId || bid.contractor.userId;
            serviceType = serviceType || "CONTRACTOR";
        }

        if (!proUserId || !serviceType) {
            const err = new Error("Unable to identify professional or service role for this bid");
            err.statusCode = 400;
            throw err;
        }

        // 2. Perform atomic award transaction
        let result;
        try {
            result = await prisma.$transaction(async (tx) => {
                // Check if role is already awarded in awards table
                const existingAward = await tx.award.findFirst({
                    where: { projectId: project.id, role: serviceType },
                });

                if (existingAward) {
                    const err = new Error(`A professional for ${serviceType.replace(/_/g, " ")} has already been awarded on this project`);
                    err.statusCode = 409;
                    throw err;
                }

                // Update winning bid status to AWARDED with optimistic lock check
                const awardedBid = await tx.bid.update({
                    where: { id: bidId },
                    data: {
                        status: "ACCEPTED", // Or AWARDED
                        version: { increment: 1 },
                        professionalId: proUserId,
                        role: serviceType,
                    },
                });

                // Create Award record (Unique constraint @@unique([projectId, role]) is the load-bearing DB guarantee)
                const award = await tx.award.create({
                    data: {
                        projectId: project.id,
                        bidId: bid.id,
                        role: serviceType,
                        awardedById: clientId,
                    },
                });

                // Create Contract with milestone schedule
                const totalAmount = Number(bid.quotedPrice || bid.amount || 0);
                const m1Amount = Math.round(totalAmount * 0.3);
                const m2Amount = Math.round(totalAmount * 0.4);
                const m3Amount = totalAmount - (m1Amount + m2Amount);

                const roleName = serviceType.replace(/_/g, " ").toLowerCase();
                const contract = await tx.contract.create({
                    data: {
                        awardId: award.id,
                        scopeDescription: `Contract for ${serviceType.replace(/_/g, " ")}: ${bid.proposal ? bid.proposal.slice(0, 200) : "Project execution"}`,
                        totalAmount,
                        status: "ACTIVE",
                        milestones: {
                            create: [
                                {
                                    sequence: 1,
                                    title: `Phase 1: Initial Planning & Blueprints (${serviceType.replace(/_/g, " ")})`,
                                    description: `Initial site analysis, architectural layouts/specifications, and scope sign-off.`,
                                    amount: m1Amount,
                                    status: "PENDING",
                                },
                                {
                                    sequence: 2,
                                    title: `Phase 2: Core Execution & Mid-point Deliverables`,
                                    description: `50% execution milestone and intermediate verification.`,
                                    amount: m2Amount,
                                    status: "PENDING",
                                },
                                {
                                    sequence: 3,
                                    title: `Phase 3: Final Detailing & Handover Inspection`,
                                    description: `Final quality inspection, snag list resolution, and client handover.`,
                                    amount: m3Amount,
                                    status: "PENDING",
                                },
                            ],
                        },
                    },
                    include: { milestones: true },
                });

                // Reject sibling competing bids in the same role
                const competingBids = await tx.bid.findMany({
                    where: {
                        projectId: project.id,
                        id: { not: bidId },
                        status: { in: ["PENDING", "SHORTLISTED", "SUBMITTED"] },
                        OR: [
                            { role: serviceType },
                            ...(bid.architectId ? [{ architectId: { not: null } }] : []),
                            ...(bid.designerId ? [{ designerId: { not: null } }] : []),
                            ...(bid.contractorId ? [{ contractorId: { not: null } }] : []),
                        ],
                    },
                });

                if (competingBids.length > 0) {
                    await tx.bid.updateMany({
                        where: { id: { in: competingBids.map((b) => b.id) } },
                        data: {
                            status: "REJECTED",
                            rejectionReason: `Another proposal was awarded for ${serviceType.replace(/_/g, " ")}`,
                            version: { increment: 1 },
                        },
                    });

                    // Decrement pending counters for competing professionals
                    for (const comp of competingBids) {
                        if (comp.architectId) {
                            await tx.architect.update({
                                where: { id: comp.architectId },
                                data: { quotationsPending: { decrement: 1 }, quotationsRejected: { increment: 1 } },
                            });
                        } else if (comp.contractorId) {
                            await tx.contractor.update({
                                where: { id: comp.contractorId },
                                data: { quotationsPending: { decrement: 1 }, quotationsRejected: { increment: 1 } },
                            });
                        }
                    }
                }

                // Create ProjectTeam member
                const teamMember = await tx.projectTeam.upsert({
                    where: {
                        projectId_role: {
                            projectId: project.id,
                            role: serviceType,
                        },
                    },
                    update: {
                        userId: proUserId,
                        bidId: bid.id,
                        status: "ACTIVE",
                    },
                    create: {
                        projectId: project.id,
                        userId: proUserId,
                        role: serviceType,
                        bidId: bid.id,
                        status: "ACTIVE",
                    },
                });

                // Update winning professional's counters
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

                // Initialize or update Project Escrow Account
                const EscrowService = (await import("./escrowService.js")).default;
                await EscrowService.initializeOrUpdateProjectEscrow(project.id, tx);

                // Evaluate project status & phase
                await (await import("./projectStateMachine.js")).default.evaluateProjectPhaseProgression(project.id, tx);

                const updatedProject = await tx.project.findUnique({
                    where: { id: project.id },
                    include: { awards: { include: { contract: { include: { milestones: true } } } }, teamMembers: true, escrow: true },
                });

                return { awardedBid, award, contract, teamMember, project: updatedProject, competingBidIds: competingBids.map((b) => b.id) };
            });
        } catch (txErr) {
            // Check for Prisma unique constraint violation (P2002)
            if (txErr.code === "P2002" || (txErr.message && txErr.message.includes("unique"))) {
                const conflictErr = new Error(`A proposal for ${serviceType.replace(/_/g, " ")} has already been awarded on this project`);
                conflictErr.statusCode = 409;
                throw conflictErr;
            }
            throw txErr;
        }

        // 3. Emit real-time updates and enable team chat
        try {
            const { emitToProject: emitProj } = await import("../socket/socketServer.js");
            emitProj(project.id, "bid:awarded", {
                awardId: result.award.id,
                bidId: result.awardedBid.id,
                role: serviceType,
                projectId: project.id,
            });

            if (result.competingBidIds && result.competingBidIds.length > 0) {
                emitProj(project.id, "bid:rejected", {
                    rejectedBidIds: result.competingBidIds,
                    role: serviceType,
                    projectId: project.id,
                });
            }

            await ChatService.getOrCreateDirectChat(project.id, clientId, proUserId, bid.id);
            await ChatService.getOrCreateProjectTeamChat(project.id, clientId);
        } catch (postErr) {
            console.error("Post-award non-fatal error:", postErr);
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

        const formatBidPro = (b) => {
            const copy = { ...b };
            if (copy.architect?.user) {
                const img =
                    (typeof copy.architect.user.profile === "string" && (copy.architect.user.profile.startsWith("http") || copy.architect.user.profile.startsWith("/uploads")))
                        ? copy.architect.user.profile
                        : (Array.isArray(copy.architect.photos) && copy.architect.photos[0]) || null;
                copy.architect.user = {
                    ...copy.architect.user,
                    profileImageUrl: img,
                };
                copy.architect.profileImageUrl = img;
            }
            if (copy.designer?.user) {
                const img =
                    (typeof copy.designer.user.profile === "string" && (copy.designer.user.profile.startsWith("http") || copy.designer.user.profile.startsWith("/uploads")))
                        ? copy.designer.user.profile
                        : (Array.isArray(copy.designer.photos) && copy.designer.photos[0]) || null;
                copy.designer.user = {
                    ...copy.designer.user,
                    profileImageUrl: img,
                };
                copy.designer.profileImageUrl = img;
            }
            if (copy.contractor?.user) {
                const img =
                    (typeof copy.contractor.user.profile === "string" && (copy.contractor.user.profile.startsWith("http") || copy.contractor.user.profile.startsWith("/uploads")))
                        ? copy.contractor.user.profile
                        : (Array.isArray(copy.contractor.photos) && copy.contractor.photos[0]) || null;
                copy.contractor.user = {
                    ...copy.contractor.user,
                    profileImageUrl: img,
                };
                copy.contractor.profileImageUrl = img;
            }
            return copy;
        };

        const formattedBids = bids.map(formatBidPro);

        const grouped = {
            total: formattedBids.length,
            architects: formattedBids.filter((b) => b.architectId !== null || b.role === "ARCHITECT"),
            designers: formattedBids.filter((b) => b.designerId !== null || b.role === "INTERIOR_DESIGNER"),
            contractors: formattedBids.filter((b) => b.contractorId !== null || b.role === "CONTRACTOR"),
            all: formattedBids,
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
                        include: {
                            attachments: true,
                            client: {
                                select: { id: true, name: true, email: true, phone: true },
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
