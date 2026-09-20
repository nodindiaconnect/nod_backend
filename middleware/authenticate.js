import Jwt from "jsonwebtoken";
import helper from "../helper/helper.js";
import prisma from "../config/prismaClient.js";
import db from "../config/db.js";

export const getJwtSecret = () =>
  process.env.JWT_SK ||
  db?.JWT_SK ||
  process.env.JWT_SK_PROD ||
  "3afb3875be5526c6c13aebfe449431e3fdbee46d77bf60c0f693ad44118c9031";

export const Auth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return helper.failed(res, "Auth Token is required", {}, 401);
    }
    token = token.split(" ")[1];

    Jwt.verify(token, getJwtSecret(), async (err, decode) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return helper.failed(
            res,
            "Token expired, please refresh the token",
            {},
            408,
          );
        }
        return helper.failed(res, "Invalid Token", {}, 401);
      }

      const findUser = await prisma.user.findUnique({
        where: { id: decode.id },
      });

      if (!findUser || findUser.isDeleted) {
        return helper.failed(res, "Invalid User", {}, 401);
      }

      if (findUser.role === 1 && findUser.isVerified === false) {
        return helper.failed(res, "User Not Verified", {
          email: findUser.email,
        });
      }

      if (findUser.isBlocked === true) {
        return helper.failed(
          res,
          "User has been blocked",
          {
            email: findUser.email,
          },
          401,
        );
      }

      if (findUser.role === 0 || findUser.role === 7) {
        req.admin = findUser;
      } else if ([1, 2, 3, 4, 5].includes(findUser.role)) {
        req.user = findUser;
      } else {
        return helper.failed(res, "Invalid User Role", {}, 403);
      }

      next();
    });
  } catch (error) {
    next(error);
  }
};



export const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.admin) {
      return helper.failed(res, "You Are Not Authorised", {}, 401);
    }
    next();
  } catch (error) {
    next(error);
  }
};


export const verifyUser = async (req, res, next) => {
  try {
    if (!req.user && !req.admin) {
      return helper.failed(res, "You Are Not Authorised", {}, 401);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const verifyAccountant = async (req, res, next) => {
  try {
    if (!req.admin || ![0, 7].includes(req.admin.role)) {
      return helper.failed(res, "You Are Not Authorised", {}, 401);
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Checks the permissions of the logged-in admin user
 * - Role 0 (Super Admin) bypasses all permission checks
 * - Role 7 (subAdmin) must have the specific permission in permissions array
 */
export const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return helper.failed(res, "You Are Not Authorised", {}, 401);
      }

      // Super Admin (Role 0) has full unrestricted access
      if (req.admin.role === 0) {
        return next();
      }

      // Sub-Admin (Role 7)
      if (req.admin.role === 7) {
        const adminUserPermissions = req.admin.permissions || [];
        if (!adminUserPermissions.includes(permission)) {
          return helper.failed(
            res,
            `Access denied: User doesn't have ${permission} Permission`,
            {},
            403,
          );
        }
        return next();
      }

      return helper.failed(
        res,
        "Access denied: User doesn't have the required role or permissions",
        {},
        403,
      );
    } catch (error) {
      console.log(error);
      return helper.err(res, error, req.path);
    }
  };
};

export const socketAuth = async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token && token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    console.log("Incoming Socket Token:", token ? "present" : "missing");

    if (!token) {
      console.log("No token provided for socket");
      return next(new Error("Authentication failed"));
    }

    const decoded = Jwt.verify(token, getJwtSecret());


    const findUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!findUser) {
      console.log("Invalid user");
      return next(new Error("Invalid User"));
    }

    if (findUser.role == 1 && findUser.isBlocked == true) {
      return next(new Error("User blocked"));
    }

    socket.user = findUser;

    console.log("Authenticated:", findUser.id);

    next();
  } catch (error) {
    console.log("Socket Auth Error:", error.message);
    return next(new Error("Unauthorized"));
  }
};