-- Every boutique now gets its own public storefront route
-- (/{locale}/{storeType}), so everything a visitor sees — site name,
-- announcement bar, hero, SEO, theme choice — moves from the StoreSettings
-- singleton onto StoreType (already one row per boutique), same pattern as
-- the earlier move of payment/contact fields. Backfill both StoreType rows
-- from today's singleton as a starting point; this content is written for
-- Sport, review/replace it for Cosmétique from Réglages once migrated.
ALTER TABLE "StoreType" ADD COLUMN "siteName" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "announcementText" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroImagePath" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroImagePosition" TEXT NOT NULL DEFAULT 'right';
ALTER TABLE "StoreType" ADD COLUMN "heroTitle" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroSubtitle" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroBadgeText" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroCtaLabel" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "seoDescription" TEXT;

UPDATE "StoreType" SET
  "siteName" = (SELECT "siteName" FROM "StoreSettings" WHERE id = 'singleton'),
  "announcementText" = (SELECT "announcementText" FROM "StoreSettings" WHERE id = 'singleton'),
  "heroImagePath" = (SELECT "heroImagePath" FROM "StoreSettings" WHERE id = 'singleton'),
  "heroImagePosition" = COALESCE((SELECT "heroImagePosition" FROM "StoreSettings" WHERE id = 'singleton'), 'right'),
  "heroTitle" = (SELECT "heroTitle" FROM "StoreSettings" WHERE id = 'singleton'),
  "heroSubtitle" = (SELECT "heroSubtitle" FROM "StoreSettings" WHERE id = 'singleton'),
  "heroBadgeText" = (SELECT "heroBadgeText" FROM "StoreSettings" WHERE id = 'singleton'),
  "heroCtaLabel" = (SELECT "heroCtaLabel" FROM "StoreSettings" WHERE id = 'singleton'),
  "seoTitle" = (SELECT "seoTitle" FROM "StoreSettings" WHERE id = 'singleton'),
  "seoDescription" = (SELECT "seoDescription" FROM "StoreSettings" WHERE id = 'singleton');

-- StoreSettings keeps a single job now: which boutique "/" redirects to.
ALTER TABLE "StoreSettings" DROP COLUMN "siteName";
ALTER TABLE "StoreSettings" DROP COLUMN "announcementText";
ALTER TABLE "StoreSettings" DROP COLUMN "heroImagePath";
ALTER TABLE "StoreSettings" DROP COLUMN "heroImagePosition";
ALTER TABLE "StoreSettings" DROP COLUMN "heroTitle";
ALTER TABLE "StoreSettings" DROP COLUMN "heroSubtitle";
ALTER TABLE "StoreSettings" DROP COLUMN "heroBadgeText";
ALTER TABLE "StoreSettings" DROP COLUMN "heroCtaLabel";
ALTER TABLE "StoreSettings" DROP COLUMN "seoTitle";
ALTER TABLE "StoreSettings" DROP COLUMN "seoDescription";
ALTER TABLE "StoreSettings" DROP COLUMN "themeId";
