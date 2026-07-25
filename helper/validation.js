import { Validator } from "node-input-validator";
const validation = async (req, res, next) => {
  let path = req.path.toString();
  console.log({ path });



  if (path.includes("/register")) {
    var feilds = {
      email: "required|email",
      password: "required",
      phone: "required",
      countryCode: "required",
    };
  }
  if (path.includes("/isVerify")) {
    var feilds = {
      email: "required|email",
      otpType: "required|in:register,forgotPassword,ChangePassword",
      otp: "required",
    };
  }
  if (path.includes("/resendOtp") || path.includes("/forgotPassword")) {
    var feilds = {
      email: "required|email",
    };
  }
  if (path.includes("/login")) {
    var feilds = {
      password: "required",
      // role: "required",
    };
  }


  if (path.includes("/resetPassword")) {
    var feilds = {
      email: "required|email",
      newPassword: "required",
    };
  }
  if (path.includes("/changePassword")) {
    if (path == "/changePassword") {
      var feilds = {
        newPassword: "required",
      };
    } else {
      var feilds = {
        password: "required",
      };
    }
  }

  if (path.includes("/reCAPTCHAVerify")) {
    var feilds = {
      response: "required",
    };
  }



  const v = new Validator(req.body, feilds);
  v.check()
    .then((matched) => {
      if (!matched) {
        return res.status(400).send(v.errors);
      } else {
        next();
      }
    })
    .catch(console.log);
};

export default validation;
