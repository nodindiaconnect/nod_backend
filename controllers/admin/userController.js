import prisma from "../../config/prismaClient.js";


// page/limit from query string, always returns safe positive numbers
const buildPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// case-insensitive search across the fields users are likely to search by
const buildSearchWhere = (search) => {
  if (!search || !search.trim()) return {};
  const term = search.trim();
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { username: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
    ],
  };
};

const paginatedResponse = (res, users, counts, page, limit) => {
  const { total, active, blocked } = counts;
  return res.status(200).json({
    success: true,
    data: users,
    pagination: {
      jaimax_users: total,
      blocked,
      total,
      active,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
};

// runs total/active/blocked counts for a given role's where clause (minus isBlocked)
const getUserCounts = async (baseWhere) => {
  const [total, blocked] = await Promise.all([
    prisma.user.count({ where: baseWhere }),
    prisma.user.count({ where: { ...baseWhere, isBlocked: true } }),
  ]);
  return { total, blocked, active: total - blocked };
};

class UserController {

  // Get Clients (role 1) — paginated + searchable
  static async getClientUsers(req, res) {
    try {
      const { page, limit, skip } = buildPagination(req);

      const where = {
        role: 1,
        isDeleted: false,
        ...buildSearchWhere(req.query.search),
      };

      const [users, counts] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        getUserCounts(where),
      ]);

      return paginatedResponse(res, users, counts, page, limit);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }


  // Get Designers (role 2) — paginated + searchable
  static async getDesignerUsers(req, res) {
    try {
      const { page, limit, skip } = buildPagination(req);

      const where = {
        role: 2,
        isDeleted: false,
        ...buildSearchWhere(req.query.search),
      };

      const [users, counts] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        getUserCounts(where),
      ]);

      return paginatedResponse(res, users, counts, page, limit);

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
      const { page, limit, skip } = buildPagination(req);

      const where = {
        role: 3,
        isDeleted: false,
        ...buildSearchWhere(req.query.search),
      };

      const [users, counts] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        getUserCounts(where),
      ]);

      return paginatedResponse(res, users, counts, page, limit);

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
      const { page, limit, skip } = buildPagination(req);

      const where = {
        role: 4,
        isDeleted: false,
        ...buildSearchWhere(req.query.search),
      };

      const [users, counts] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        getUserCounts(where),
      ]);

      return paginatedResponse(res, users, counts, page, limit);

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

      // Only allow whitelisted, editable fields — never password/createdAt/id
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
        data: updatedUser
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
        data: updatedUser
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
        data: updatedUser
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
        data: deletedUser
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