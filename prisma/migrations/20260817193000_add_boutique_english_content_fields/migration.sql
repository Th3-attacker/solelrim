-- English overrides for the same fields that already had an Arabic one
-- (siteName, heroTitle, heroSubtitle, seoTitle, seoDescription) — French
-- stays the base/fallback column for all three. All nullable, additive:
-- no backfill needed, existing rows just have no English override yet.
ALTER TABLE "StoreType" ADD COLUMN "siteNameEn" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroTitleEn" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "heroSubtitleEn" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "seoTitleEn" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "seoDescriptionEn" TEXT;
