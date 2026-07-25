/*
  Warnings:

  - The `servicesRequired` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `designStyle` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `spaceRequirements` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "servicesRequired",
ADD COLUMN     "servicesRequired" "ServiceType"[],
DROP COLUMN "designStyle",
ADD COLUMN     "designStyle" "DesignStyle"[],
DROP COLUMN "spaceRequirements",
ADD COLUMN     "spaceRequirements" "SpaceRequirement"[];
