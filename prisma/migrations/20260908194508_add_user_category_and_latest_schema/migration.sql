-- CreateEnum
CREATE TYPE "ProjectEscrowStatus" AS ENUM ('UNFUNDED', 'PAYMENT_REQUIRED', 'PARTIALLY_FUNDED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('INITIAL_DEPOSIT_50', 'PLATFORM_FEE_5', 'ESCROW_HOLD', 'MILESTONE_RELEASE', 'DISPUTE_HOLD', 'DISPUTE_REFUND_CLIENT', 'DISPUTE_RELEASE_PRO', 'FINAL_RELEASE');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_RELEASED', 'RESOLVED_REFUNDED', 'RESOLVED_SPLIT', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "MilestoneStatus" ADD VALUE 'REVISION_REQUIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_FUNDED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RAISED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'PAYMENT_REQUIRED';

-- AlterTable
ALTER TABLE "Designer" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "category" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEscrow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalProjectValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialDepositRequired" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialDepositPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "platformFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "escrowBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReleasedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRefundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDisputedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProjectEscrowStatus" NOT NULL DEFAULT 'UNFUNDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEscrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEscrowTransaction" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "type" "EscrowTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "milestoneId" TEXT,
    "userId" TEXT,
    "description" TEXT,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDispute" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "raisedById" TEXT NOT NULL,
    "raisedByRole" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disputedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "adminDecision" TEXT,
    "adminNotes" TEXT,
    "resolvedById" TEXT,
    "refundAmountClient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "releaseAmountPro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "escrowId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PROJECT_PLATFORM_FEE',
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "milestoneId" TEXT,
    "milestoneSequence" INTEGER NOT NULL DEFAULT 1,
    "milestoneTitle" TEXT NOT NULL,
    "milestonePercentage" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "totalProjectValue" DOUBLE PRECISION NOT NULL,
    "milestoneAmount" DOUBLE PRECISION NOT NULL,
    "platformFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "platformFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountPaid" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transactionId" TEXT,
    "paymentGateway" TEXT NOT NULL DEFAULT 'DUMMY',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "pdfUrl" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bankAccount" TEXT,
    "ifscCode" TEXT,
    "accountHolder" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "referenceId" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_name_categoryId_key" ON "Specialization"("name", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEscrow_projectId_key" ON "ProjectEscrow"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEscrow_projectId_idx" ON "ProjectEscrow"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEscrow_status_idx" ON "ProjectEscrow"("status");

-- CreateIndex
CREATE INDEX "ProjectEscrowTransaction_escrowId_idx" ON "ProjectEscrowTransaction"("escrowId");

-- CreateIndex
CREATE INDEX "ProjectEscrowTransaction_type_idx" ON "ProjectEscrowTransaction"("type");

-- CreateIndex
CREATE INDEX "ProjectEscrowTransaction_userId_idx" ON "ProjectEscrowTransaction"("userId");

-- CreateIndex
CREATE INDEX "ProjectDispute_escrowId_idx" ON "ProjectDispute"("escrowId");

-- CreateIndex
CREATE INDEX "ProjectDispute_milestoneId_idx" ON "ProjectDispute"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectDispute_status_idx" ON "ProjectDispute"("status");

-- CreateIndex
CREATE INDEX "PlatformRevenue_projectId_idx" ON "PlatformRevenue"("projectId");

-- CreateIndex
CREATE INDEX "PlatformRevenue_createdAt_idx" ON "PlatformRevenue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_idempotencyKey_key" ON "Withdrawal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_walletId_idx" ON "Withdrawal"("walletId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- AddForeignKey
ALTER TABLE "Specialization" ADD CONSTRAINT "Specialization_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEscrow" ADD CONSTRAINT "ProjectEscrow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEscrowTransaction" ADD CONSTRAINT "ProjectEscrowTransaction_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "ProjectEscrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEscrowTransaction" ADD CONSTRAINT "ProjectEscrowTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDispute" ADD CONSTRAINT "ProjectDispute_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "ProjectEscrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDispute" ADD CONSTRAINT "ProjectDispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDispute" ADD CONSTRAINT "ProjectDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
