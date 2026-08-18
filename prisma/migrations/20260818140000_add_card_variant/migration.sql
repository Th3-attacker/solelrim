-- Which product-card layout to render (filled/muted, outlined border, or
-- with a quick "add to cart" button) — additive, defaults to "default" so
-- existing boutiques keep their current card look unchanged.
ALTER TABLE "StoreType" ADD COLUMN "cardVariant" TEXT NOT NULL DEFAULT 'default';
