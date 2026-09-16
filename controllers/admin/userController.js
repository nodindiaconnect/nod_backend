import prisma from "../../config/prismaClient.js";

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

function sanitizeUserResponse(user) {
  if (!user) return null;
  const {
    password,
    isDeleted,
    forgotReq,
    loginTime,
    registeredDate,
    activeDate,
    isVerified,
    isRegistered,
    lockedUntil,
    failedLoginAttempts,
    role,
    ...rest
  } = user;
  return { ...rest, role: ACCOUNT_TYPE_NAMES[role] || role };
}

class UserController {

  // Get Clients (role 1) — paginated + searchable
  static async getClientUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();

      const where = {
        role: 1,
        isDeleted: false,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total, blocked] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { ...where, isBlocked: true } }),
      ]);

      const data = users.map(sanitizeUserResponse);

      return res.status(200).json({
        success: true,
        data,
        pagination: {
          Nod_users: total,
          blocked,
          total,
          active: total - blocked,
          page,
          limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Get Designers (role 2) — paginated + searchable + filterable by category & specialization
  static async getDesignerUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const category = (req.query.category || "").trim();
      const specialization = (req.query.specialization || "").trim();

      const where = {
        role: 2,
        isDeleted: false,
      };

      const andConditions = [];

      if (search) {
        andConditions.push({
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        });
      }

      if (category) {
        andConditions.push({
          OR: [
            { category: { equals: category, mode: "insensitive" } },
            { designer: { category: { equals: category, mode: "insensitive" } } },
          ],
        });
      }

      if (specialization) {
        andConditions.push({
          OR: [
            { specialization: { equals: specialization, mode: "insensitive" } },
            { designer: { specializations: { has: specialization } } },
          ],
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      const [users, total, blocked] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            designer: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { ...where, isBlocked: true } }),
      ]);

      const data = users.map((user) => {
        const {
          password,
          isDeleted,
          forgotReq,
          loginTime,
          registeredDate,
          activeDate,
          isVerified,
          isRegistered,
          lockedUntil,
          failedLoginAttempts,
          role,
          designer,
          ...rest
        } = user;

        const resolvedCategory = user.category || designer?.category || "N/A";
        const resolvedSpecialization =
          user.specialization ||
          (designer?.specializations && designer.specializations.length > 0
            ? designer.specializations.join(", ")
            : "N/A");

        return {
          ...rest,
          category: resolvedCategory,
          specialization: resolvedSpecialization,
          specializations:
            designer?.specializations ||
            (user.specialization ? [user.specialization] : []),
          designerDetails: designer || null,
          role: ACCOUNT_TYPE_NAMES[role] || role,
        };
      });

      return res.status(200).json({
        success: true,
        data,
        pagination: {
          Nod_users: total,
          blocked,
          total,
          active: total - blocked,
          page,
          limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get Architects (role 3) — paginated + searchable
  static async getArchitectUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();

      const where = {
        role: 3,
        isDeleted: false,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total, blocked] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { ...where, isBlocked: true } }),
      ]);

      const data = users.map(sanitizeUserResponse);

      return res.status(200).json({
        success: true,
        data,
        pagination: {
          Nod_users: total,
          blocked,
          total,
          active: total - blocked,
          page,
          limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Get Contractors (role 4) — paginated + searchable
  static async getContractorUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();

      const where = {
        role: 4,
        isDeleted: false,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total, blocked] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { ...where, isBlocked: true } }),
      ]);

      const data = users.map(sanitizeUserResponse);

      return res.status(200).json({
        success: true,
        data,
        pagination: {
          Nod_users: total,
          blocked,
          total,
          active: total - blocked,
          page,
          limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Update User Details (admin edit)
  static async updateUser(req, res) {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser || existingUser.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const allowedFields = [
        "name",
        "username",
        "email",
        "phone",
        "countryCode",
        "country",
        "state",
        "city",
        "address",
        "profile"
      ];

      const updateData = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided to update"
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData
      });

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: sanitizeUserResponse(updatedUser)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Block User
  static async blockUser(req, res) {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser || existingUser.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (existingUser.isBlocked) {
        return res.status(400).json({
          success: false,
          message: "User is already blocked"
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isBlocked: true }
      });

      return res.status(200).json({
        success: true,
        message: "User blocked successfully",
        data: sanitizeUserResponse(updatedUser)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Unblock User
  static async unblockUser(req, res) {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser || existingUser.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!existingUser.isBlocked) {
        return res.status(400).json({
          success: false,
          message: "User is already unblocked"
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isBlocked: false }
      });

      return res.status(200).json({
        success: true,
        message: "User unblocked successfully",
        data: sanitizeUserResponse(updatedUser)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Delete User (Soft Delete)
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (existingUser.isDeleted) {
        return res.status(400).json({
          success: false,
          message: "User is already deleted"
        });
      }

      const deletedUser = await prisma.user.update({
        where: { id },
        data: { isDeleted: true }
      });

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: sanitizeUserResponse(deletedUser)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

}

export default UserController;