import crypto from "crypto";
import prisma from "../config/prismaClient.js";

// How long a person has to finish each multi-step flow before the
// session (and anything tied to it) is treated as gone.
const SESSION_TTL_MS = {
  register: 20 * 60 * 1000, // 20 minutes to finish signup
  forgot: 10 * 60 * 1000,   // 10 minutes to finish a password reset
};

function generateToken(prefix) {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

const sessionStore = {
  /**
   * Start a new register/forgot session. Also opportunistically sweeps
   * expired sessions + OTPs so nothing lingers in the DB past its TTL
   * even if nobody ever calls back in to read it.
   */
  async create({ type, email, userId = null, ip, userAgent }) {
    await sessionStore.purgeExpired();

    const token = generateToken(type === "register" ? "REG" : "FGT");

    return prisma.authSession.create({
      data: {
        token,
        type,
        step: "started",
        email,
        userId,
        ip,
        userAgent,
        expireAt: new Date(Date.now() + SESSION_TTL_MS[type]),
      },
    });
  },

  /**
   * Look up a session by token, scoped to the expected flow type.
   * Expired sessions are deleted on read (vanish-on-read) and treated
   * as if they never existed.
   */
  async get(token, type) {
    if (!token || typeof token !== "string") return null;

    const session = await prisma.authSession.findUnique({ where: { token } });
    if (!session || session.type !== type) return null;

    if (session.expireAt < new Date()) {
      await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session;
  },

  async advance(id, data) {
    return prisma.authSession.update({ where: { id }, data }).catch(() => null);
  },

  async destroy(id) {
    return prisma.authSession.delete({ where: { id } }).catch(() => {});
  },

  async bumpAttempts(id) {
    return prisma.authSession
      .update({ where: { id }, data: { attempts: { increment: 1 } } })
      .catch(() => null);
  },

  /** Deletes anything (sessions, OTPs) whose expiry has already passed. */
  async purgeExpired() {
    const now = new Date();
    await Promise.all([
      prisma.authSession.deleteMany({ where: { expireAt: { lt: now } } }),
      prisma.otp.deleteMany({ where: { expireTime: { lt: now } } }),
    ]).catch(() => {});
  },
};

export default sessionStore;