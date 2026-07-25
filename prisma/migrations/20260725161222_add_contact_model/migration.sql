-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('monsoon_makeover_popup', 'contact_section', 'other');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'closed');

-- CreateTable
CREATE TABLE "contact_leads" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150),
    "country_code" VARCHAR(6) NOT NULL DEFAULT '+91',
    "phone" VARCHAR(15) NOT NULL,
    "pincode" VARCHAR(6),
    "company" VARCHAR(150),
    "details" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'other',
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_leads_created_at_idx" ON "contact_leads"("created_at");

-- CreateIndex
CREATE INDEX "contact_leads_phone_idx" ON "contact_leads"("phone");
