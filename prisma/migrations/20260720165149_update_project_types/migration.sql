/*
  Warnings:

  - The values [DRAFT] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `budgetMin` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `budgetMax` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `totalAvailableBalance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the `Nod` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `servicesRequired` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `designStyle` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `spaceRequirements` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY', 'MID', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArchitectSpecialization" AS ENUM ('RESIDENTIAL_PLANNING', 'COMMERCIAL_PLANNING', 'STRUCTURAL_DESIGN', 'URBAN_PLANNING', 'LANDSCAPE_ARCHITECTURE', 'RENOVATION_PLANNING');

-- CreateEnum
CREATE TYPE "ContractorWorkType" AS ENUM ('CIVIL_WORK', 'ELECTRICAL', 'PLUMBING', 'CARPENTRY', 'PAINTING', 'FALSE_CEILING_INSTALLATION', 'MODULAR_KITCHEN_INSTALLATION', 'FULL_TURNKEY_EXECUTION');

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('WAITING_FOR_QUOTATIONS', 'PROPOSALS_RECEIVED', 'HIRED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_QUOTATIONS';
COMMIT;

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- DropIndex
DROP INDEX "Wallet_userId_idx";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "servicesRequired",
ADD COLUMN     "servicesRequired" TEXT NOT NULL,
DROP COLUMN "designStyle",
ADD COLUMN     "designStyle" TEXT NOT NULL,
DROP COLUMN "spaceRequirements",
ADD COLUMN     "spaceRequirements" TEXT NOT NULL,
ALTER COLUMN "budgetMin" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "budgetMax" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "totalAvailableBalance" SET DATA TYPE DOUBLE PRECISION;

-- DropTable
DROP TABLE "Nod";

-- CreateTable
CREATE TABLE "Architect" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "yearsOfExperience" INTEGER NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "specializations" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseIssuingBody" TEXT,
    "certifications" TEXT NOT NULL,
    "portfolioLinks" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "serviceCities" TEXT NOT NULL,
    "minBudgetHandled" DOUBLE PRECISION NOT NULL,
    "maxBudgetHandled" DOUBLE PRECISION NOT NULL,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalQuotationsSent" INTEGER NOT NULL DEFAULT 0,
    "quotationsPending" INTEGER NOT NULL DEFAULT 0,
    "quotationsAccepted" INTEGER NOT NULL DEFAULT 0,
    "quotationsRejected" INTEGER NOT NULL DEFAULT 0,
    "totalProjectsHandled" INTEGER NOT NULL DEFAULT 0,
    "projectsInProgress" INTEGER NOT NULL DEFAULT 0,
    "projectsCompleted" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Architect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "designerId" TEXT,
    "architectId" TEXT,
    "contractorId" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "yearsOfExperience" INTEGER NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "workTypes" TEXT NOT NULL,
    "teamSize" INTEGER,
    "licenseNumber" TEXT,
    "gstNumber" TEXT,
    "certifications" TEXT NOT NULL,
    "portfolioLinks" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "serviceCities" TEXT NOT NULL,
    "minBudgetHandled" DOUBLE PRECISION NOT NULL,
    "maxBudgetHandled" DOUBLE PRECISION NOT NULL,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalQuotationsSent" INTEGER NOT NULL DEFAULT 0,
    "quotationsPending" INTEGER NOT NULL DEFAULT 0,
    "quotationsAccepted" INTEGER NOT NULL DEFAULT 0,
    "quotationsRejected" INTEGER NOT NULL DEFAULT 0,
    "totalProjectsHandled" INTEGER NOT NULL DEFAULT 0,
    "projectsInProgress" INTEGER NOT NULL DEFAULT 0,
    "projectsCompleted" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "yearsOfExperience" INTEGER NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "designStyles" TEXT NOT NULL,
    "specializations" TEXT NOT NULL,
    "certifications" TEXT NOT NULL,
    "portfolioLinks" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "govtIdNumber" TEXT,
    "serviceCities" TEXT NOT NULL,
    "minBudgetHandled" DOUBLE PRECISION NOT NULL,
    "maxBudgetHandled" DOUBLE PRECISION NOT NULL,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalQuotationsSent" INTEGER NOT NULL DEFAULT 0,
    "quotationsPending" INTEGER NOT NULL DEFAULT 0,
    "quotationsAccepted" INTEGER NOT NULL DEFAULT 0,
    "quotationsRejected" INTEGER NOT NULL DEFAULT 0,
    "totalProjectsHandled" INTEGER NOT NULL DEFAULT 0,
    "projectsInProgress" INTEGER NOT NULL DEFAULT 0,
    "projectsCompleted" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Architect_userId_key" ON "Architect"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Architect_licenseNumber_key" ON "Architect"("licenseNumber");

-- CreateIndex
CREATE INDEX "Architect_userId_idx" ON "Architect"("userId");

-- CreateIndex
CREATE INDEX "Architect_licenseNumber_idx" ON "Architect"("licenseNumber");

-- CreateIndex
CREATE INDEX "Architect_verificationStatus_idx" ON "Architect"("verificationStatus");

-- CreateIndex
CREATE INDEX "Architect_availability_idx" ON "Architect"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_userId_key" ON "Contractor"("userId");

-- CreateIndex
CREATE INDEX "Contractor_userId_idx" ON "Contractor"("userId");

-- CreateIndex
CREATE INDEX "Contractor_verificationStatus_idx" ON "Contractor"("verificationStatus");

-- CreateIndex
CREATE INDEX "Contractor_availability_idx" ON "Contractor"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "Designer_userId_key" ON "Designer"("userId");

-- CreateIndex
CREATE INDEX "Designer_userId_idx" ON "Designer"("userId");

-- CreateIndex
CREATE INDEX "Designer_verificationStatus_idx" ON "Designer"("verificationStatus");

-- CreateIndex
CREATE INDEX "Designer_availability_idx" ON "Designer"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- AddForeignKey
ALTER TABLE "Architect" ADD CONSTRAINT "Architect_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designer" ADD CONSTRAINT "Designer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
