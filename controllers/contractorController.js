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


class ContractorController {



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
      });
    } catch (error) {
      next(error);
    }
  }





  // GET /api/contractor/me/overview
  // Returns profile + quotation/project stats for the logged-in contractor's dashboard
  static async getOverview(req, res) {
    try {
      const userId = req.user.id // set by auth middleware

      const contractor = await prisma.contractor.findUnique({
        where: { userId },
        include: { user: true },
      })

      if (!contractor) {
        return res.status(404).json({ success: false, message: "Contractor profile not found" })
      }

      const projectStats = {
        totalProjects: contractor.totalProjectsHandled,
        activeProjects: contractor.projectsInProgress,
        completedProjects: contractor.projectsCompleted,
        pendingProjects: contractor.quotationsPending,
        cancelledProjects: contractor.quotationsRejected,
      }

      const quotationStats = {
        totalQuotationsSent: contractor.totalQuotationsSent,
        quotationsPending: contractor.quotationsPending,
        quotationsAccepted: contractor.quotationsAccepted,
        quotationsRejected: contractor.quotationsRejected,
      }

      return res.status(200).json({
        success: true,
        data: {
          name: contractor.user.name,
          username: contractor.user.username,
          email: contractor.user.email,
          phone: contractor.user.phone,
          countryCode: contractor.user.countryCode,
          city: contractor.user.city,
          country: contractor.user.country,
          isVerified: contractor.verificationStatus === "VERIFIED",
          role: 4,
          walletBalance: contractor.user.walletBalance ?? 0,
          projectStats,
          quotationStats,
        },
      })
    } catch (err) {
      console.error("contractorController.getOverview error:", err)
      return res.status(500).json({ success: false, message: "Failed to fetch contractor overview" })
    }
  }

  // GET /api/contractor/me/quotations?status=PENDING|ACCEPTED|REJECTED
  static async getQuotations(req, res) {
    try {
      const userId = req.user.id;

      const bids = await prisma.bid.findMany({
        where: {
          contractorId: userId,
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
      console.error("contractorController.getQuotations error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch quotations",
      });
    }
  }
  // POST /api/contractor/quotations
  // Send a new quotation/bid on a project
  static async sendQuotation(req, res) {
    try {
      const userId = req.user.id
      const { projectId, quotedPrice, proposedDuration, proposal, portfolioLink } = req.body

      if (!projectId || !quotedPrice || !proposedDuration || !proposal) {
        return res.status(400).json({ success: false, message: "Missing required quotation fields" })
      }

      const contractor = await prisma.contractor.findUnique({ where: { userId } })
      if (!contractor) {
        return res.status(404).json({ success: false, message: "Contractor profile not found" })
      }

      const bid = await prisma.$transaction(async (tx) => {
        const created = await tx.bid.create({
          data: {
            projectId,
            contractorId: contractor.id,
            quotedPrice,
            proposedDuration,
            proposal,
            portfolioLink,
            status: "PENDING",
          },
        })

        await tx.contractor.update({
          where: { id: contractor.id },
          data: {
            totalQuotationsSent: { increment: 1 },
            quotationsPending: { increment: 1 },
          },
        })

        return created
      })

      return res.status(201).json({ success: true, data: bid })
    } catch (err) {
      console.error("contractorController.sendQuotation error:", err)
      return res.status(500).json({ success: false, message: "Failed to send quotation" })
    }
  }

  // GET /api/contractor/me/projects?status=IN_PROGRESS|COMPLETED



  // GET /api/contractor/me/projects?status=IN_PROGRESS|COMPLETED&page=1&limit=10
  // static async getProjectsToBid(req, res) {
  //   try {
  //     const { status } = req.query
  //     const page = parseInt(req.query.page, 10) || 1
  //     const limit = parseInt(req.query.limit, 10) || 10
  //     const skip = (page - 1) * limit

  //     const where = {
  //       servicesRequired: { has: "CONTRACTOR" },
  //       ...(status ? { status } : {}),
  //     }

  //     const [projects, totalProjects] = await Promise.all([
  //       prisma.project.findMany({
  //         where,
  //         include: {
  //           attachments: true,
  //         },
  //         orderBy: { createdAt: "desc" },
  //         skip,
  //         take: limit,
  //       }),
  //       prisma.project.count({ where }),
  //     ])

  //     return res.status(200).json({
  //       success: true,
  //       data: projects,
  //       pagination: {
  //         total: totalProjects,
  //         page,
  //         limit,
  //         totalPages: Math.ceil(totalProjects / limit),
  //       },
  //     })
  //   } catch (err) {
  //     console.error("contractorController.getProjects error:", err)
  //     return res.status(500).json({ success: false, message: "Failed to fetch projects" })
  //   }
  // }


  static async getProjectsToBid(req, res) {
    try {
      const { status } = req.query
      const page = parseInt(req.query.page, 10) || 1
      const limit = parseInt(req.query.limit, 10) || 10
      const skip = (page - 1) * limit

      const where = {
        servicesRequired: { has: "CONTRACTOR" },
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
      console.error("contractorController.getProjects error:", err)
      return res.status(500).json({ success: false, message: "Failed to fetch projects" })
    }
  }


  // PATCH /api/contractor/quotations/:bidId/withdraw
  static async withdrawQuotation(req, res) {
    try {
      const userId = req.user.id
      const { bidId } = req.params

      const contractor = await prisma.contractor.findUnique({ where: { userId } })
      if (!contractor) {
        return res.status(404).json({ success: false, message: "Contractor profile not found" })
      }

      const bid = await prisma.bid.findFirst({ where: { id: bidId, contractorId: contractor.id } })
      if (!bid) {
        return res.status(404).json({ success: false, message: "Quotation not found" })
      }
      if (bid.status !== "PENDING") {
        return res.status(400).json({ success: false, message: "Only pending quotations can be withdrawn" })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.bid.update({ where: { id: bidId }, data: { status: "WITHDRAWN" } })
        await tx.contractor.update({
          where: { id: contractor.id },
          data: { quotationsPending: { decrement: 1 } },
        })
        return u
      })

      return res.status(200).json({ success: true, data: updated })
    } catch (err) {
      console.error("contractorController.withdrawQuotation error:", err)
      return res.status(500).json({ success: false, message: "Failed to withdraw quotation" })
    }
  }





}


export default ContractorController;