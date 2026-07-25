import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

class ArchitechController {



    static async getUserDetails(req, res, next) {
        try {

            // console.log(req.user, "userId123")

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

            return helper.success(res, "User details fetched successfully", user);
        } catch (error) {
            next(error);
        }
    }


    // GET /api/architect/me/overview
    // Returns profile + quotation/project stats for the logged-in architect's dashboard
    static async getOverview(req, res) {
        try {
            const userId = req.user.id // set by auth middleware

            const architect = await prisma.architect.findUnique({
                where: { userId },
                include: { user: true },
            })

            if (!architect) {
                return res.status(404).json({ success: false, message: "Architect profile not found" })
            }

            const projectStats = {
                totalProjects: architect.totalProjectsHandled,
                activeProjects: architect.projectsInProgress,
                completedProjects: architect.projectsCompleted,
                pendingProjects: architect.quotationsPending,
                cancelledProjects: architect.quotationsRejected,
            }

            const quotationStats = {
                totalQuotationsSent: architect.totalQuotationsSent,
                quotationsPending: architect.quotationsPending,
                quotationsAccepted: architect.quotationsAccepted,
                quotationsRejected: architect.quotationsRejected,
            }

            return res.status(200).json({
                success: true,
                data: {
                    name: architect.user.name,
                    username: architect.user.username,
                    email: architect.user.email,
                    phone: architect.user.phone,
                    countryCode: architect.user.countryCode,
                    city: architect.user.city,
                    country: architect.user.country,
                    isVerified: architect.verificationStatus === "VERIFIED",
                    role: 3,
                    walletBalance: architect.user.walletBalance ?? 0,
                    projectStats,
                    quotationStats,
                },
            })
        } catch (err) {
            console.error("architectController.getOverview error:", err)
            return res.status(500).json({ success: false, message: "Failed to fetch architect overview" })
        }
    }

    // GET /api/architect/me/quotations?status=PENDING|ACCEPTED|REJECTED
    static async getQuotations(req, res) {

        console.log(req.user,"req.user")
        try {
            const userId = req.user.id
            // const { status } = req.query

            console.log(userId,"userIdqwww")

            const architect = await prisma.architect.findUnique({ where: { userId } })
            if (!architect) {
                return res.status(400).json({ success: false, message: "Architect profile not found" })
            }

            const bids = await prisma.bid.findMany({
                where: {
                    architectId: architect.id,
                    // ...(status ? { status } : {}),
                },
                // include: { project: true },
                orderBy: { createdAt: "desc" },
            })

            return res.status(200).json({ success: true, data: bids })
        } catch (err) {
            console.error("architectController.getQuotations error:", err)
            return res.status(500).json({ success: false, message: "Failed to fetch quotations" })
        }
    }

    // POST /api/architect/quotations
    // Send a new quotation/bid on a project
    static async sendQuotation(req, res) {
        try {
            const userId = req.user.id
            const { projectId, quotedPrice, proposedDuration, proposal, portfolioLink } = req.body

            if (!projectId || !quotedPrice || !proposedDuration || !proposal) {
                return res.status(400).json({ success: false, message: "Missing required quotation fields" })
            }

            const architect = await prisma.architect.findUnique({ where: { userId } })
            if (!architect) {
                return res.status(404).json({ success: false, message: "Architect profile not found" })
            }

            const bid = await prisma.$transaction(async (tx) => {
                const created = await tx.bid.create({
                    data: {
                        projectId,
                        architectId: architect.id,
                        quotedPrice,
                        proposedDuration,
                        proposal,
                        portfolioLink,
                        status: "PENDING",
                    },
                })

                await tx.architect.update({
                    where: { id: architect.id },
                    data: {
                        totalQuotationsSent: { increment: 1 },
                        quotationsPending: { increment: 1 },
                    },
                })

                return created
            })

            return res.status(201).json({ success: true, data: bid })
        } catch (err) {
            console.error("architectController.sendQuotation error:", err)
            return res.status(500).json({ success: false, message: "Failed to send quotation" })
        }
    }

    // GET /api/architect/me/projects?status=IN_PROGRESS|COMPLETED

    static async getProjectsToBid(req, res) {
        try {
            const { status } = req.query

            const projects = await prisma.project.findMany({
                where: {
                    servicesRequired: { has: "ARCHITECT" },
                    ...(status ? { status } : {}),
                },
                include: {
                    attachments: true,
                },
                orderBy: { createdAt: "desc" },
            })

            if (!projects.length) {
                return res.status(200).json({ success: true, data: [] })
            }

            return res.status(200).json({ success: true, data: projects })
        } catch (err) {
            console.error("designerController.getProjects error:", err)
            return res.status(500).json({ success: false, message: "Failed to fetch projects" })
        }
    }
    // PATCH /api/architect/quotations/:bidId/withdraw
    static async withdrawQuotation(req, res) {
        try {
            const userId = req.user.id
            const { bidId } = req.params

            const architect = await prisma.architect.findUnique({ where: { userId } })
            if (!architect) {
                return res.status(404).json({ success: false, message: "Architect profile not found" })
            }

            const bid = await prisma.bid.findFirst({ where: { id: bidId, architectId: architect.id } })
            if (!bid) {
                return res.status(404).json({ success: false, message: "Quotation not found" })
            }
            if (bid.status !== "PENDING") {
                return res.status(400).json({ success: false, message: "Only pending quotations can be withdrawn" })
            }

            const updated = await prisma.$transaction(async (tx) => {
                const u = await tx.bid.update({ where: { id: bidId }, data: { status: "WITHDRAWN" } })
                await tx.architect.update({
                    where: { id: architect.id },
                    data: { quotationsPending: { decrement: 1 } },
                })
                return u
            })

            return res.status(200).json({ success: true, data: updated })
        } catch (err) {
            console.error("architectController.withdrawQuotation error:", err)
            return res.status(500).json({ success: false, message: "Failed to withdraw quotation" })
        }
    }




}


export default ArchitechController;