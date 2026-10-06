import SystemConfigService from "./systemConfigService.js";

/**
 * Centralized Tax & Payment Calculation Service for NOD
 * Ensures all financial figures (Platform Fees, Designer Commission,
 * Non-refundable 4% component, GST/Taxes, Designer Payouts, Net Platform Earnings)
 * derive from one transparent, mathematically consistent backend engine.
 */
class TaxService {
    static DEFAULT_CONFIG = {
        platformFeeRate: 5.0,        // 5% client platform fee
        designerCommissionRate: 5.0, // 5% designer commission
        nonRefundableRate: 4.0,      // 4% non-refundable platform/service component
        gstRate: 18.0,               // 18% GST on taxable platform fees
    };

    /**
     * Compute comprehensive, mathematically exact payment breakdown
     */
    static calculateBreakdown({
        baseProjectAmount,
        platformFeeRate = 5.0,
        designerCommissionRate = 5.0,
        nonRefundableRate = 4.0,
        gstRate = 18.0,
        isInterState = false,
    }) {
        const baseAmount = Math.max(0, Math.round(Number(baseProjectAmount) || 0));
        const pFeeRate = Number(platformFeeRate) >= 0 ? Number(platformFeeRate) : TaxService.DEFAULT_CONFIG.platformFeeRate;
        const dCommRate = Number(designerCommissionRate) >= 0 ? Number(designerCommissionRate) : TaxService.DEFAULT_CONFIG.designerCommissionRate;
        const nrRate = Number(nonRefundableRate) >= 0 ? Number(nonRefundableRate) : TaxService.DEFAULT_CONFIG.nonRefundableRate;
        const gRate = Number(gstRate) >= 0 ? Number(gstRate) : TaxService.DEFAULT_CONFIG.gstRate;

        // Platform fee charged to client
        const platformFeeAmount = Math.round(baseAmount * (pFeeRate / 100));

        // Non-refundable service component (4% of base project amount)
        const nonRefundableAmount = Math.round(baseAmount * (nrRate / 100));

        // Designer commission deducted from designer earnings
        const designerCommissionAmount = Math.round(baseAmount * (dCommRate / 100));

        // GST is levied on the taxable platform fee
        const taxableAmount = platformFeeAmount;
        const totalGst = Math.round(taxableAmount * (gRate / 100));
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isInterState) {
            igst = totalGst;
        } else {
            cgst = Math.round(totalGst / 2);
            sgst = totalGst - cgst;
        }

        // Total amount payable by client for full project
        const totalClientPayable = baseAmount + platformFeeAmount + totalGst;

        // Standard milestone distribution: 50% Advance, 25% Second, 25% Final
        const advanceAmount = Math.round(baseAmount * 0.50);
        const secondMilestoneAmount = Math.round(baseAmount * 0.25);
        const finalMilestoneAmount = baseAmount - (advanceAmount + secondMilestoneAmount);

        // Advance payable by client includes 50% deposit + full platform fee + GST
        const advancePayableWithFee = advanceAmount + platformFeeAmount + totalGst;

        // Designer payout: Base project amount minus designer commission
        const designerEligiblePayout = Math.max(0, baseAmount - designerCommissionAmount);

        // Company Net Earnings (platform revenue from client + commission from designer)
        const platformRevenue = platformFeeAmount + designerCommissionAmount;
        const netPlatformEarnings = platformRevenue; // before gateway costs

        return {
            baseProjectAmount: baseAmount,
            platformFeeRate: pFeeRate,
            platformFeeAmount,
            designerCommissionRate: dCommRate,
            designerCommissionAmount,
            nonRefundableRate: nrRate,
            nonRefundableAmount,
            taxableAmount,
            gstRate: gRate,
            cgst,
            sgst,
            igst,
            totalGst,
            totalClientPayable,
            advanceAmount,
            advancePayableWithFee,
            secondMilestoneAmount,
            finalMilestoneAmount,
            designerEligiblePayout,
            platformRevenue,
            netPlatformEarnings,
        };
    }

    /**
     * Calculate Dispute Settlement Breakdown (Admin Arbitration Rule)
     * Client Refund = Total Client Paid - (Admin-Approved Designer Settlement + Non-refundable 4% component + Other Deductions)
     */
    static calculateDisputeSettlement({
        totalPaidAmount,
        adminApprovedDesignerAmount,
        nonRefundableComponent = 0,
        otherDeductions = 0,
    }) {
        const totalPaid = Math.max(0, Number(totalPaidAmount) || 0);
        const approvedDesigner = Math.max(0, Number(adminApprovedDesignerAmount) || 0);
        const nonRefundable = Math.max(0, Number(nonRefundableComponent) || 0);
        const deductions = Math.max(0, Number(otherDeductions) || 0);

        const totalDeductions = approvedDesigner + nonRefundable + deductions;
        const eligibleClientRefund = Math.max(0, totalPaid - totalDeductions);

        return {
            totalPaidAmount: totalPaid,
            adminApprovedDesignerAmount: approvedDesigner,
            nonRefundableComponent: nonRefundable,
            otherDeductions: deductions,
            totalDeductions,
            eligibleClientRefund,
        };
    }
}

export default TaxService;
