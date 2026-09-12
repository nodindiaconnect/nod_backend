import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

// Helper to mask account number e.g. "•••• •••• •••• 1234"
export function maskAccountNumber(accNo) {
  if (!accNo || typeof accNo !== "string") return "";
  const cleaned = accNo.trim();
  if (cleaned.length <= 4) return cleaned;
  const last4 = cleaned.slice(-4);
  const maskedCount = cleaned.length - 4;
  const numBlocks = Math.ceil(maskedCount / 4);
  const dotsArray = [];
  for (let i = 0; i < numBlocks; i++) {
    const blockSize = Math.min(4, maskedCount - i * 4);
    dotsArray.push("•".repeat(blockSize));
  }
  return `${dotsArray.join(" ")} ${last4}`;
}

class BankController {
  /**
   * GET /api/bank-details
   * Securely retrieve logged-in user's bank details with masked account number
   */
  static async getBankDetails(req, res) {
    try {
      const userId = req.user?.id || req.admin?.id;
      if (!userId) {
        return helper.failed(res, "Unauthorized", {}, 401);
      }

      const bankDetail = await prisma.bankDetail.findUnique({
        where: { userId },
      });

      if (!bankDetail) {
        return helper.success(res, "No bank details found", {
          isConfigured: false,
          bankDetails: null,
        });
      }

      return helper.success(res, "Bank details retrieved successfully", {
        isConfigured: true,
        bankDetails: {
          id: bankDetail.id,
          accountHolderName: bankDetail.accountHolderName,
          bankName: bankDetail.bankName,
          accountType: bankDetail.accountType,
          ifscCode: bankDetail.ifscCode,
          maskedAccountNumber: maskAccountNumber(bankDetail.accountNumber),
          last4: bankDetail.accountNumber.slice(-4),
          updatedAt: bankDetail.updatedAt,
        },
      });
    } catch (error) {
      console.error("getBankDetails error:", error);
      return helper.failed(res, "Failed to retrieve bank details", {}, 500);
    }
  }

  /**
   * POST / PUT /api/bank-details
   * Securely add or update bank details for the authenticated user
   */
  static async saveBankDetails(req, res) {
    try {
      const userId = req.user?.id || req.admin?.id;
      if (!userId) {
        return helper.failed(res, "Unauthorized", {}, 401);
      }

      let { accountHolderName, bankName, accountNumber, ifscCode, accountType } = req.body;

      // 1. Validate Account Holder Name
      if (!accountHolderName || typeof accountHolderName !== "string") {
        return helper.failed(res, "Account holder name is required.");
      }
      accountHolderName = accountHolderName.trim();
      if (accountHolderName.length < 2 || accountHolderName.length > 100) {
        return helper.failed(res, "Account holder name must be between 2 and 100 characters.");
      }
      if (!/^[a-zA-Z\s\.\']+$/.test(accountHolderName)) {
        return helper.failed(res, "Account holder name should only contain letters, spaces, and periods.");
      }

      // 2. Validate Bank Name
      if (!bankName || typeof bankName !== "string") {
        return helper.failed(res, "Bank name is required.");
      }
      bankName = bankName.trim();
      if (bankName.length < 2 || bankName.length > 100) {
        return helper.failed(res, "Bank name must be between 2 and 100 characters.");
      }

      // 3. Validate Account Number
      if (!accountNumber || typeof accountNumber !== "string") {
        return helper.failed(res, "Account number is required.");
      }
      const cleanAccountNumber = accountNumber.trim().replace(/[\s-]/g, "");
      if (!/^\d{9,18}$/.test(cleanAccountNumber)) {
        return helper.failed(res, "Account number must be between 9 and 18 numeric digits.");
      }

      // 4. Validate IFSC Code (Standard Indian IFSC format: 4 letters, '0', 6 alphanumeric)
      if (!ifscCode || typeof ifscCode !== "string") {
        return helper.failed(res, "IFSC code is required.");
      }
      const cleanIfsc = ifscCode.trim().toUpperCase();
      const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!IFSC_REGEX.test(cleanIfsc)) {
        return helper.failed(res, "Invalid IFSC code format (e.g., HDFC0001234, SBIN0004567).");
      }

      // 5. Validate Account Type
      const normalizedAccountType = (accountType || "SAVINGS").trim().toUpperCase();
      if (!["SAVINGS", "CURRENT"].includes(normalizedAccountType)) {
        return helper.failed(res, "Account type must be either SAVINGS or CURRENT.");
      }

      // 6. Upsert Bank Details
      const updated = await prisma.bankDetail.upsert({
        where: { userId },
        create: {
          userId,
          accountHolderName,
          bankName,
          accountNumber: cleanAccountNumber,
          ifscCode: cleanIfsc,
          accountType: normalizedAccountType,
        },
        update: {
          accountHolderName,
          bankName,
          accountNumber: cleanAccountNumber,
          ifscCode: cleanIfsc,
          accountType: normalizedAccountType,
        },
      });

      return helper.success(res, "Bank details saved securely", {
        isConfigured: true,
        bankDetails: {
          id: updated.id,
          accountHolderName: updated.accountHolderName,
          bankName: updated.bankName,
          accountType: updated.accountType,
          ifscCode: updated.ifscCode,
          maskedAccountNumber: maskAccountNumber(updated.accountNumber),
          last4: updated.accountNumber.slice(-4),
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      console.error("saveBankDetails error:", error);
      return helper.failed(res, "Failed to save bank details", {}, 500);
    }
  }
}

export default BankController;
