import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";


const ACCOUNT_TYPES = {
    Client: 1,
    Designer: 2,
    Architect: 3,
    Contractor: 4,
    MaterialSupplier: 5,
};

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
    Object.entries(ACCOUNT_TYPES).map(([name, code]) => [code, name])
);



class DesignController {
    static async getUserDetails(req, res, next) {
        try {
            const userId = req.user.id;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    phone: true,
                    countryCode: true,
                    role: true,
                    country: true,
                    state: true,
                    city: true,
                    address: true,
                    activeDate: true,
                    isVerified: true,
                    isBlocked: true,
                    walletBalance: true,
                },
            });

            if (!user) {
                return helper.failed(res, "User not found");
            }

            const designer = await prisma.designer.findUnique({
                where: { userId },
                select: {
                    totalProjectsHandled: true,
                    projectsInProgress: true,
                    projectsCompleted: true,
                    totalQuotationsSent: true,
                    quotationsPending: true,
                    quotationsAccepted: true,
                    quotationsRejected: true,
                },
            });

            return helper.success(res, "User details fetched successfully", {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: ACCOUNT_TYPE_NAMES[user.role] ?? "Unknown",
                country: user.country,
                state: user.state,
                city: user.city,
                address: user.address,
                walletBalance: user.walletBalance,
                projectStats: {
                    totalProjects: designer?.totalProjectsHandled ?? 0,
                    activeProjects: designer?.projectsInProgress ?? 0,
                    completedProjects: designer?.projectsCompleted ?? 0,
                },
                quotationStats: {
                    totalQuotationsSent: designer?.totalQuotationsSent ?? 0,
                    quotationsPending: designer?.quotationsPending ?? 0,
                    quotationsAccepted: designer?.quotationsAccepted ?? 0,
                    quotationsRejected: designer?.quotationsRejected ?? 0,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/designer/me/quotations?status=PENDING|ACCEPTED|REJECTED
    static async getQuotations(req, res) {
        try {
            const userId = req.user.id;

            // console.log(userId, "userId123")

            const bids = await prisma.bid.findMany({
                where: {
                    designerId: userId,
                },
                include: {
                    project: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            return res.status(200).json({
                success: true,
                data: bids,
            });
        } catch (err) {
            console.error("designerController.getQuotations error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch quotations",
            });
        }
    }



    // POST /api/designer/quotations
    static async sendQuotation(req, res) {
        try {
            const userId = req.user.id
            const { projectId, quotedPrice, proposedDuration, proposal, portfolioLink } = req.body

            if (!projectId || !quotedPrice || !proposedDuration || !proposal) {
                return res.status(400).json({ success: false, message: "Missing required quotation fields" })
            }

            const designer = await prisma.designer.findUnique({ where: { userId } })
            if (!designer) {
                return res.status(404).json({ success: false, message: "Designer profile not found" })
            }

            const bid = await prisma.$transaction(async (tx) => {
                const created = await tx.bid.create({
                    data: {
                        projectId,
                        designerId: designer.id,
                        quotedPrice,
                        proposedDuration,
                        proposal,
                        portfolioLink,
                        status: "PENDING",
                    },
                })

                await tx.designer.update({
                    where: { id: designer.id },
                    data: {
                        totalQuotationsSent: { increment: 1 },
                        quotationsPending: { increment: 1 },
                    },
                })

                return created
            })

            return res.status(201).json({ success: true, data: bid })
        } catch (err) {
            console.error("designerController.sendQuotation error:", err)
            return res.status(500).json({ success: false, message: "Failed to send quotation" })
        }
    }


    // static async getProjectsToBid(req, res) {
    //     try {
    //         const { status } = req.query
    //         const page = parseInt(req.query.page, 10) || 1
    //         const limit = parseInt(req.query.limit, 10) || 10
    //         const skip = (page - 1) * limit

    //         const where = {
    //             servicesRequired: { has: "ARCHITECT" },
    //             ...(status ? { status } : {}),
    //         }

    //         const [projects, totalProjects] = await Promise.all([
    //             prisma.project.findMany({
    //                 where,
    //                 include: {
    //                     attachments: true,
    //                 },
    //                 orderBy: { createdAt: "desc" },
    //                 skip,
    //                 take: limit,
    //             }),
    //             prisma.project.count({ where }),
    //         ])

    //         return res.status(200).json({
    //             success: true,
    //             data: projects,
    //             pagination: {
    //                 total: totalProjects,
    //                 page,
    //                 limit,
    //                 totalPages: Math.ceil(totalProjects / limit),
    //             },
    //         })
    //     } catch (err) {
    //         console.error("designerController.getProjects error:", err)
    //         return res.status(500).json({ success: false, message: "Failed to fetch projects" })
    //     }
    // }

    // PATCH /api/designer/quotations/:bidId/withdraw



    static async getProjectsToBid(req, res) {
        try {
            const { status } = req.query
            const page = parseInt(req.query.page, 10) || 1
            const limit = parseInt(req.query.limit, 10) || 10
            const skip = (page - 1) * limit

            const where = {
                servicesRequired: { has: "ARCHITECT" },
                availabilityStatus: "OPEN",   // ✅ only fetch projects open for bidding
                ...(status ? { status } : {}),
            }

            const [projects, totalProjects] = await Promise.all([
                prisma.project.findMany({
                    where,
                    include: {
                        attachments: true,
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                prisma.project.count({ where }),
            ])

            return res.status(200).json({
                success: true,
                data: projects,
                pagination: {
                    total: totalProjects,
                    page,
                    limit,
                    totalPages: Math.ceil(totalProjects / limit),
                },
            })
        } catch (err) {
            console.error("designerController.getProjects error:", err)
            return res.status(500).json({ success: false, message: "Failed to fetch projects" })
        }
    }

    static async withdrawQuotation(req, res) {
        try {
            const userId = req.user.id
            const { bidId } = req.params

            const designer = await prisma.designer.findUnique({ where: { userId } })
            if (!designer) {
                return res.status(404).json({ success: false, message: "Designer profile not found" })
            }

            const bid = await prisma.bid.findFirst({ where: { id: bidId, designerId: designer.id } })
            if (!bid) {
                return res.status(404).json({ success: false, message: "Quotation not found" })
            }
            if (bid.status !== "PENDING") {
                return res.status(400).json({ success: false, message: "Only pending quotations can be withdrawn" })
            }

            const updated = await prisma.$transaction(async (tx) => {
                const u = await tx.bid.update({ where: { id: bidId }, data: { status: "WITHDRAWN" } })
                await tx.designer.update({
                    where: { id: designer.id },
                    data: { quotationsPending: { decrement: 1 } },
                })
                return u
            })

            return res.status(200).json({ success: true, data: updated })
        } catch (err) {
            console.error("designerController.withdrawQuotation error:", err)
            return res.status(500).json({ success: false, message: "Failed to withdraw quotation" })
        }
    }

}

export default DesignController;