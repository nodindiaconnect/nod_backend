-- CreateEnum
CREATE TYPE "ProjectAvailabilityStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "availabilityStatus" "ProjectAvailabilityStatus" NOT NULL DEFAULT 'OPEN';
