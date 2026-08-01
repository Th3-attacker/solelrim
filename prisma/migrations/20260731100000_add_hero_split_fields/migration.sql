-- AlterTable
ALTER TABLE "StoreSettings"
  ADD COLUMN     "heroImagePosition" TEXT NOT NULL DEFAULT 'right',
  ADD COLUMN     "heroBadgeText" TEXT,
  ADD COLUMN     "heroCtaLabel" TEXT;
