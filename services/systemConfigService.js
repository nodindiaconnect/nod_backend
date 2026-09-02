import prisma from "../config/prismaClient.js";
import logger from "../helper/logger.js";
import AuditService from "./auditService.js";

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5.0;
let cachedFee = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

class SystemConfigService {
    /**
     * Get the active Platform Fee percentage (e.g. 5.0)
     */
    static async getPlatformFeePercentage() {
        const now = Date.now();
        if (cachedFee !== null && now - lastCacheTime < CACHE_TTL_MS) {
            return cachedFee;
        }

        try {
            // Check if SystemConfig table is available in Prisma
            if (prisma.systemConfig) {
                const config = await prisma.systemConfig.findUnique({
                    where: { key: "PLATFORM_FEE_PERCENTAGE" },
                });

                if (config && config.value) {
                    const parsed = parseFloat(config.value);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
                        cachedFee = parsed;
                        lastCacheTime = now;
                        return parsed;
                    }
                }
            }
        } catch (err) {
            logger.warn(`[SystemConfigService] Failed to read from DB, using fallback: ${err.message}`);
        }

        cachedFee = DEFAULT_PLATFORM_FEE_PERCENTAGE;
        lastCacheTime = now;
        return DEFAULT_PLATFORM_FEE_PERCENTAGE;
    }

    /**
     * Update the active Platform Fee percentage (Admin only)
     */
    static async updatePlatformFeePercentage(adminUser, newPercentage, req = null) {
        const parsed = parseFloat(newPercentage);
        if (isNaN(parsed)) {
            throw new Error("Invalid platform fee: Must be a valid number");
        }

        if (parsed < 0 || parsed > 50) {
            throw new Error("Platform fee percentage must be between 0% and 50%");
        }

        const normalizedFee = parseFloat(parsed.toFixed(2));
        const previousFee = await SystemConfigService.getPlatformFeePercentage();

        if (prisma.systemConfig) {
            await prisma.systemConfig.upsert({
                where: { key: "PLATFORM_FEE_PERCENTAGE" },
                update: {
                    value: String(normalizedFee),
                    updatedBy: adminUser?.id || "ADMIN",
                },
                create: {
                    key: "PLATFORM_FEE_PERCENTAGE",
                    value: String(normalizedFee),
                    description: "Global Platform Fee percentage applied to project contracts",
                    updatedBy: adminUser?.id || "ADMIN",
                },
            });
        }

        cachedFee = normalizedFee;
        lastCacheTime = Date.now();

        // Log audit event
        try {
            if (adminUser?.id) {
                const adminExists = await prisma.user.findUnique({
                    where: { id: adminUser.id },
                    select: { id: true },
                });
                if (adminExists) {
                    await AuditService.logAction({
                        adminId: adminUser.id,
                        action: "UPDATE_PLATFORM_FEE",
                        entityType: "SYSTEM_CONFIG",
                        entityId: "PLATFORM_FEE_PERCENTAGE",
                        details: {
                            previousFee,
                            newFee: normalizedFee,
                        },
                        req,
                    });
                }
            }
        } catch (auditErr) {
            logger.warn(`[SystemConfigService] Audit log warning: ${auditErr.message}`);
        }

        logger.info(`[SystemConfigService] Platform fee updated to ${normalizedFee}% by admin ${adminUser?.id}`);
        return {
            platformFeePercentage: normalizedFee,
            previousFee,
            updatedAt: new Date(),
        };
    }
}

export default SystemConfigService;
