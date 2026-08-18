-- Which of the hero layouts to render (split image, full-bleed poster,
-- minimal banner) — additive, defaults to "split" so existing boutiques
-- keep their current look unchanged.
ALTER TABLE "StoreType" ADD COLUMN "heroVariant" TEXT NOT NULL DEFAULT 'split';
