/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `activeDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `countryCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `forgotReq` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isBlocked` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `loginTime` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profile` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `registeredDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `walletBalance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Otp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'OFFICE', 'VILLA', 'APARTMENT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('ARCHITECT', 'INTERIOR_DESIGNER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('NEW_CONSTRUCTION', 'RENOVATION', 'REMODELING');

-- CreateEnum
CREATE TYPE "DesignStyle" AS ENUM ('MODERN', 'MINIMALIST', 'LUXURY', 'CONTEMPORARY', 'TRADITIONAL', 'SCANDINAVIAN');

-- CreateEnum
CREATE TYPE "SpaceRequirement" AS ENUM ('MODULAR_KITCHEN', 'WARDROBES', 'FALSE_CEILING', 'TV_UNIT', 'LIGHTING', 'FURNITURE');

-- CreateEnum
CREATE TYPE "ClientInvolvement" AS ENUM ('HANDS_OFF', 'OCCASIONAL_CHECK_INS', 'ACTIVELY_INVOLVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENT', 'NORMAL', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CommunicationMode" AS ENUM ('CHAT', 'PHONE', 'VIDEO_CALL');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('FLOOR_PLAN', 'PROPERTY_PHOTO', 'REFERENCE_IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'WAITING_FOR_QUOTATIONS', 'PROPOSALS_RECEIVED', 'HIRED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Otp" DROP CONSTRAINT "Otp_userId_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- DropIndex
DROP INDEX "User_email_idx";

-- DropIndex
DROP INDEX "User_isActive_isBlocked_idx";

-- DropIndex
DROP INDEX "User_phone_idx";

-- DropIndex
DROP INDEX "User_phone_key";

-- DropIndex
DROP INDEX "User_role_idx";

-- DropIndex
DROP INDEX "User_username_idx";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "activeDate",
DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "countryCode",
DROP COLUMN "forgotReq",
DROP COLUMN "isActive",
DROP COLUMN "isBlocked",
DROP COLUMN "isDeleted",
DROP COLUMN "isVerified",
DROP COLUMN "loginTime",
DROP COLUMN "password",
DROP COLUMN "profile",
DROP COLUMN "registeredDate",
DROP COLUMN "role",
DROP COLUMN "state",
DROP COLUMN "username",
DROP COLUMN "walletBalance",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "phone" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- DropTable
DROP TABLE "Otp";

-- DropTable
DROP TABLE "Wallet";

-- DropTable
DROP TABLE "logs";

-- CreateTable
CREATE TABLE "Nod" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ProjectCategory" NOT NULL,
    "servicesRequired" "ServiceType"[],
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "propertySize" DOUBLE PRECISION NOT NULL,
    "numberOfFloors" INTEGER,
    "numberOfBedrooms" INTEGER,
    "numberOfBathrooms" INTEGER,
    "propertyStatus" "PropertyStatus" NOT NULL,
    "designStyle" "DesignStyle"[],
    "colorPreferences" TEXT,
    "spaceRequirements" "SpaceRequirement"[],
    "accessibilityNeeds" TEXT,
    "spaceUsers" TEXT,
    "currentSpaceLikes" TEXT,
    "currentSpaceProblems" TEXT,
    "clientInvolvement" "ClientInvolvement",
    "budgetMin" DECIMAL(12,2) NOT NULL,
    "budgetMax" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "siteVisitRequired" BOOLEAN NOT NULL DEFAULT false,
    "preferredCommunication" "CommunicationMode",
    "preferredWorkingHours" TEXT,
    "additionalNotes" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'WAITING_FOR_QUOTATIONS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
