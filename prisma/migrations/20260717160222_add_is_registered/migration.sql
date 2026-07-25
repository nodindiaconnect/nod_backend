/*
  Warnings:

  - You are about to alter the column `walletBalance` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - Made the column `walletBalance` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_username_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeDate" TIMESTAMP(3),
ADD COLUMN     "isRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registeredDate" TIMESTAMP(3),
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "address" SET DEFAULT 'N/A',
ALTER COLUMN "city" SET DEFAULT 'N/A',
ALTER COLUMN "country" SET DEFAULT 'N/A',
ALTER COLUMN "countryCode" DROP NOT NULL,
ALTER COLUMN "profile" SET DATA TYPE TEXT,
ALTER COLUMN "role" SET DEFAULT 1,
ALTER COLUMN "state" SET DEFAULT 'N/A',
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "walletBalance" SET NOT NULL,
ALTER COLUMN "walletBalance" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "User_isActive_isBlocked_idx" ON "User"("isActive", "isBlocked");
