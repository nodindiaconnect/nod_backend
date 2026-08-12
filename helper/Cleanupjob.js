import prisma from "../config/prismaClient.js";

/**
 * Deletes expired OTPs and auth sessions. sessionStore already does this
 * lazily whenever a token is read or a new session is created, but that
 * only cleans up flows someone actually came back to. This catches the
 * abandoned ones (person requests an OTP, never enters it, never returns).
 */
export async function purgeExpiredAuthArtifacts() {
  const now = new Date();
  const [otps, sessions] = await Promise.all([
    prisma.otp.deleteMany({ where: { expireTime: { lt: now } } }),
    prisma.authSession.deleteMany({ where: { expireAt: { lt: now } } }),
  ]);
  return { otpsDeleted: otps.count, sessionsDeleted: sessions.count };
}

/** Call once at server startup. Runs immediately, then every intervalMs. */
export function startAuthCleanupScheduler(intervalMs = 5 * 60 * 1000) {
  purgeExpiredAuthArtifacts().catch((e) => console.error("auth cleanup error:", e));

  return setInterval(() => {
    purgeExpiredAuthArtifacts().catch((e) => console.error("auth cleanup error:", e));
  }, intervalMs);
}