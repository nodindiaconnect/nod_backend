// controllers/adminUserController.js
import prisma from "../../config/prismaClient.js";
import bcrypt from "bcryptjs";
import helper from "../../helper/helper.js";
import emailService from "../../helper/emailService.js";

const allPermissions = [
    "DASHBOARD",
    "ALL_USERS",
    "ADMIN_USERS",
    "ALL_PROJECTS",
    "BIDS",
    "PRODUCTS",
    "CATEGORIES",
    "FEATURED_PRODUCTS",
    "WALLETS",
    "TRANSACTIONS",
    "PROMOTIONS",
    "REVIEWS",
    "COMPLAINTS",
    "NOTIFICATIONS",
    "SETTINGS",
];

class AdminUserController {
    /* CREATE */
    static async createAdminUser(req, res, next) {
        try {
            const { name, email, password, countryCode, phone, permissions } = req.body;

            if (req.admin.role !== 0) {
                return helper.failed(res, "Only Super Admin can create other admins", {}, 403);
            }

            const existingEmail = await prisma.user.findFirst({
                where: { email, isDeleted: false },
            });

            if (existingEmail) {
                return helper.failed(res, "Email already exists", { email }, 400);
            }

            const invalidPermissions = permissions.filter((p) => !allPermissions.includes(p));
            if (invalidPermissions.length > 0) {
                return helper.failed(res, "Invalid permissions provided", { invalidPermissions }, 400);
            }

            const generatedUsername = "NOD" + (await helper.generateRandomUsername());
            const hashedPassword = await bcrypt.hash(password, 10);

            const AdminRole = 7

            const newAdmin = await prisma.user.create({
                data: {
                    name,
                    email,
                    countryCode,
                    phone,
                    password: hashedPassword,
                    role: AdminRole,
                    permissions,
                    isVerified: true,
                    isDeleted: false,
                    username: generatedUsername,
                },
            });

            setImmediate(async () => {
                try {
                    await emailService.sendAdminUserCreationMail(email, password, permissions, name);
                } catch (err) {
                    console.error("Failed to send email notification:", err.message);
                }
            });

            const responseData = {
                id: newAdmin.id,
                name: newAdmin.name,
                username: newAdmin.username,
                email: newAdmin.email,
                phone: newAdmin.phone,
                isBlocked: newAdmin.isBlocked,
                permissions: newAdmin.permissions,
                createdAt: newAdmin.createdAt,
                updatedAt: newAdmin.updatedAt,
            };

            return helper.success(res, "Admin User created successfully", responseData);
        } catch (error) {
            next(error);
        }
    }

    /* LIST (paginated + searchable) */

    static async getAdminUsers(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const skip = (page - 1) * limit;

            const where = { role: 7, isVerified: true };

            const [users, totalUsers] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        name: true,
                        isBlocked: true,
                        permissions: true,
                    },
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.user.count({ where }),
            ]);

            return helper.success(res, "All users list", {
                users,
                pagination: {
                    total: totalUsers,
                    page,
                    limit,
                    totalPages: Math.ceil(totalUsers / limit),
                },
            });
        } catch (error) {
            next(error);
        }
    }
    /* VIEW single */
    static async viewAdminUser(req, res, next) {
        try {
            const { userId } = req.params;

            const user = await prisma.user.findFirst({
                where: { id: userId, isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    phone: true,
                    countryCode: true,
                    role: true,
                    isActive: true,
                    isBlocked: true,
                    permissions: true,
                },
            });

            if (!user) {
                return helper.failed(res, "Admin user not found", {}, 404);
            }

            return helper.success(res, "Admin user detail", user);
        } catch (error) {
            next(error);
        }
    }

    /* EDIT */


    static async updateAdminUser(req, res, next) {
        try {
            const { adminId, name, email, phone, countryCode, permissions } = req.body;

            if (req.admin.role !== 0) {
                return helper.failed(res, "Only Super Admin can update admin users", {}, 403);
            }

            const adminToUpdate = await prisma.user.findFirst({
                where: { id: adminId, role: 7, isDeleted: false },
            });

            if (!adminToUpdate) {
                return helper.failed(res, "Admin user not found", {}, 400);
            }

            if (email && email !== adminToUpdate.email) {
                const emailExists = await prisma.user.findFirst({
                    where: { email, isDeleted: false },
                });
                if (emailExists) {
                    return helper.failed(res, "Email already exists", { email }, 400);
                }
            }

            if (phone && phone !== adminToUpdate.phone) {
                const phoneExists = await prisma.user.findFirst({
                    where: { phone, isDeleted: false },
                });
                if (phoneExists) {
                    return helper.failed(res, "Phone already exists", { phone }, 400);
                }
            }

            if (permissions) {
                const invalidPermissions = permissions.filter((p) => !allPermissions.includes(p));
                if (invalidPermissions.length > 0) {
                    return helper.failed(res, "Invalid permissions provided", { invalidPermissions }, 400);
                }
            }

            const updates = {};
            if (name) updates.name = name;
            if (email) updates.email = email;
            if (phone) updates.phone = phone;
            if (countryCode) updates.countryCode = countryCode;
            if (permissions) updates.permissions = permissions;

            await prisma.user.update({
                where: { id: adminId },
                data: updates,
            });

            return helper.success(res, "Admin user updated successfully", updates);
        } catch (error) {
            next(error);
        }
    }


    /* BLOCK / UNBLOCK */
    static async blockAdminUser(req, res, next) {
        try {
            const { user_id, is_blocked } = req.body;

            const user = await prisma.user.findFirst({
                where: { id: user_id, isDeleted: false },
            });

            if (!user) {
                return helper.failed(res, "User not found", {}, 404);
            }

            const updatedUser = await prisma.user.update({
                where: { id: user_id },
                data: { isBlocked: Boolean(is_blocked) },
            });

            return helper.success(
                res,
                updatedUser.isBlocked ? "User blocked successfully" : "User unblocked successfully",
                updatedUser,
            );
        } catch (error) {
            next(error);
        }
    }
}

export default AdminUserController;