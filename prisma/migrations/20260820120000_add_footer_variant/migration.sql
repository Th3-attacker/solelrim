-- Which footer layout to render (rich multi-column, a slim single row, or
-- a centered brand-forward block) — additive, defaults to "columns" so
-- existing boutiques keep their current footer look unchanged.
ALTER TABLE "StoreType" ADD COLUMN "footerVariant" TEXT NOT NULL DEFAULT 'columns';
