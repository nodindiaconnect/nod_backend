/*
  Warnings:

  - The values [ENTRY,MID,SENIOR] on the enum `ExperienceLevel` will be removed. If these variants are still used in the database, this will fail.
  - The `availability` column on the `Architect` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `availability` column on the `Contractor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `bio` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `govtIdNumber` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `projectsCompleted` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `projectsInProgress` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `quotationsAccepted` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `quotationsPending` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `quotationsRejected` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `totalProjectsHandled` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `totalQuotationsSent` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `totalReviews` on the `Designer` table. All the data in the column will be lost.
  - You are about to drop the column `verificationStatus` on the `Designer` table. All the data in the column will be lost.
  - The `designStyles` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `specializations` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `certifications` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `portfolioLinks` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `serviceCities` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `availability` column on the `Designer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'BUSY', 'UNAVAILABLE');

-- AlterEnum
BEGIN;
CREATE TYPE "ExperienceLevel_new" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
ALTER TABLE "Architect" ALTER COLUMN "experienceLevel" TYPE "ExperienceLevel_new" USING ("experienceLevel"::text::"ExperienceLevel_new");
ALTER TABLE "Contractor" ALTER COLUMN "experienceLevel" TYPE "ExperienceLevel_new" USING ("experienceLevel"::text::"ExperienceLevel_new");
ALTER TABLE "Designer" ALTER COLUMN "experienceLevel" TYPE "ExperienceLevel_new" USING ("experienceLevel"::text::"ExperienceLevel_new");
ALTER TYPE "ExperienceLevel" RENAME TO "ExperienceLevel_old";
ALTER TYPE "ExperienceLevel_new" RENAME TO "ExperienceLevel";
DROP TYPE "public"."ExperienceLevel_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Contractor" DROP CONSTRAINT "Contractor_userId_fkey";

-- DropForeignKey
ALTER TABLE "Designer" DROP CONSTRAINT "Designer_userId_fkey";

-- DropIndex
DROP INDEX "Designer_availability_idx";

-- DropIndex
DROP INDEX "Designer_userId_idx";

-- DropIndex
DROP INDEX "Designer_verificationStatus_idx";

-- AlterTable
ALTER TABLE "Architect" DROP COLUMN "availability",
ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Contractor" DROP COLUMN "availability",
ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Designer" DROP COLUMN "bio",
DROP COLUMN "deletedAt",
DROP COLUMN "govtIdNumber",
DROP COLUMN "isDeleted",
DROP COLUMN "projectsCompleted",
DROP COLUMN "projectsInProgress",
DROP COLUMN "quotationsAccepted",
DROP COLUMN "quotationsPending",
DROP COLUMN "quotationsRejected",
DROP COLUMN "rating",
DROP COLUMN "totalProjectsHandled",
DROP COLUMN "totalQuotationsSent",
DROP COLUMN "totalReviews",
DROP COLUMN "verificationStatus",
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "yearsOfExperience" DROP NOT NULL,
ALTER COLUMN "experienceLevel" DROP NOT NULL,
DROP COLUMN "designStyles",
ADD COLUMN     "designStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "specializations",
ADD COLUMN     "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "certifications",
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "portfolioLinks",
ADD COLUMN     "portfolioLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "serviceCities",
ADD COLUMN     "serviceCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "minBudgetHandled" DROP NOT NULL,
ALTER COLUMN "maxBudgetHandled" DROP NOT NULL,
DROP COLUMN "availability",
ADD COLUMN     "availability" "Availability";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "specialization" TEXT;

-- DropEnum
DROP TYPE "AvailabilityStatus";

-- CreateIndex
CREATE INDEX "Architect_availability_idx" ON "Architect"("availability");

-- CreateIndex
CREATE INDEX "Contractor_availability_idx" ON "Contractor"("availability");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designer" ADD CONSTRAINT "Designer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
