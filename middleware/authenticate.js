import Jwt from "jsonwebtoken";
import helper from "../helper/helper.js";
import prisma from "../config/prismaClient.js";


export const Auth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    console.log(token, "token1233")

    if (!token) {
      return helper.failed(res, "Auth Token is required");
    }
    token = token.split(" ")[1];

    Jwt.verify(token, process.env.JWT_SK, async (err, decode) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return helper.failed(
            res,
            "Token expired, please refresh the token",
            {},
            408,
          );
        }
        return helper.failed(res, "Invalid Token");
      }

      console.log("tokenNotExpired")

      const findUser = await prisma.user.findUnique({
        where: { id: decode.id },
      });

      if (!findUser) {
        return helper.failed(res, "Invalid User");
      }

      if (findUser.role == 1 && findUser.isVerified == false) {
        return helper.failed(res, "User Not Verified", {
          email: findUser.email,
        });
      }

      if (findUser.role == 1 && findUser.isBlocked == true) {
        return helper.failed(
          res,
          "User has been blocked",
          {
            email: findUser.email,
          },
          401,
        );
      }

      console.log(findUser, "findUserq1w2e34")

      if (findUser.role === 0) {
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
    if (!req.admin || ![3, 4].includes(req.admin.role)) {
      return helper.failed(res, "You Are Not Authorised", {}, 401);
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * This method is used to check the permissions of the logged-in user
 * @param {*} permission
 * @return {*}
 */
export const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const adminUserPermissions = req.admin.permissions || [];
      if (req.admin.role === 0) {
        return next();
      }

      if (
        (req.admin.role === 2 || req.admin.role === 3) &&
        !adminUserPermissions.includes(permission)
      ) {
        return helper.failed(
          res,
          `Access denied: User doesn't have ${permission} Permission`,
          {},
          403,
        );
      }

      if (![0, 2, 3].includes(req.admin.role)) {
        return helper.failed(
          res,
          "Access denied: User doesn't have the required role or permissions",
          {},
          403,
        );
      }

      next();
    } catch (error) {
      console.log(error);
      return helper.err(res, error, req.path);
    }
  };
};

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.query.token;

    console.log("Incoming Token:", token);

    if (!token) {
      console.log("No token provided");
      return next(new Error("Authentication failed"));
    }

    // IMPORTANT: use sync verify
    const decoded = Jwt.verify(token, process.env.JWT_SK);

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