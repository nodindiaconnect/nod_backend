import { Validator } from "node-input-validator";

const validation = async (req, res, next) => {
  let path = req.path.toString();

  let feilds = {};

  if (path.includes("/register/start")) {
    feilds = {
      email: "required|email",
      password: "required",
      phone: "required",
      countryCode: "required",
      name: "required",
      username: "required",
      role: "required",
    };

    
  } else if (path.includes("/register/verify-otp")) {
    feilds = {
      registerSessionToken: "required",
      otp: "required",
    };
  } else if (path.includes("/register/create-account")) {
    feilds = {
      registerSessionToken: "required",
    };
  } else if (path.includes("/register/finish")) {
    feilds = {
      registerSessionToken: "required",
    };
  } else if (path.includes("/resendOtp")) {
    feilds = {
      // one of these two must be present; Validator can't easily do
      // OR-required, so we allow both optional here and let the
      // controller reject if neither is supplied.
      registerSessionToken: "string",
      forgotSessionToken: "string",
    };
  } else if (path.includes("/login")) {
    feilds = {
      password: "required",
    };
  } else if (path.includes("/forgotPassword/start")) {
    feilds = {
      email: "required|email",
    };
  } else if (path.includes("/forgotPassword/verify-otp")) {
    feilds = {
      forgotSessionToken: "required",
      otp: "required",
    };
  } else if (path.includes("/resetPassword")) {
    feilds = {
      forgotSessionToken: "required",
      newPassword: "required",
    };
  } else if (path.includes("/changePasswordReq")) {
    feilds = {};
  } else if (path.includes("/changePassword")) {
    feilds = {
      newPassword: "required",
    };
  } else if (path.includes("/reCAPTCHAVerify")) {
    feilds = {
      response: "required",
    };
  } else {
    // no matching route rule — skip validation instead of crashing
    return next();
  }

  console.log(req.body,"req.body")
  const v = new Validator(req.body, feilds);
  v.check()
    .then((matched) => {
      if (!matched) {
        return res.status(400).send(v.errors);
      }
      next();
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ message: "Validation error" });
    });
};

export default validation;

