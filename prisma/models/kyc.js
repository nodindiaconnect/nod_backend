
import mongoose from "mongoose";
import User from "./users.js";

const { Schema, model } = mongoose;

const kycSchema = new Schema({
  user_id: { type: mongoose.Types.ObjectId, ref: "users", unique: true },
  aadhar_doc_front: { type: String },
  aadhar_doc_back: { type: String },
  pan_doc_front: { type: String },
  dl_doc_front: { type: String },
  dl_doc_back: { type: String },
  passport_doc_front: { type: String },
  passport_doc_back: { type: String },

  name: { type: String, required: true },
  mobile_number: { type: Number, required: true },
  address: { type: String, required: true },
  bank_account: { type: String, required: true },

  upi_id: { type: String },
  bank_name: { type: String, required: true },

  ifsc_code: { type: String, required: true },
  dob: { type: String, required: false },
  panNumber: { type: String },
  status: {
    type: String,
    enum: ["open", "inprogress", "approve", "reject"],
    default: "open",
    required: true,
  },
  verifidType: {
    type: String,
    enum: [
      "manual verified",
      "digilocker pan verified",
      "camera verifyed with doc",
      "not verified yet",
      "aadhar dob verified",
      "pan verified",
      "aadhar and pan verified",
      "pan and aadhar verified",
      "admin verified",
    ],
    default: "not verified yet",
  },
  reason: { type: String },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  digilockerVerified: {
    type: Boolean,
  },
  createdAt: {
    type: Date,
    default: () => new Date(Date.now() + 5.5 * 60 * 60 * 1000),
  },
});

const kyc = model("kyc", kycSchema);

export default kyc;
