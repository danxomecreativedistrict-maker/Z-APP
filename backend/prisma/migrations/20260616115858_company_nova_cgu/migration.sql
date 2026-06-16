-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "alertPhone" TEXT,
ADD COLUMN     "dailySummaryOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailySummaryTime" TEXT NOT NULL DEFAULT '20:00',
ADD COLUMN     "delivererPhone" TEXT,
ADD COLUMN     "deliveryDelay" TEXT,
ADD COLUMN     "deliveryPolicy" TEXT,
ADD COLUMN     "deliveryZones" TEXT[],
ADD COLUMN     "novaLanguage" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentPolicy" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;
