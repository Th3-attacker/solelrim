-- Registry of boutiques (Sport, Cosmétique, or any custom type created via
-- createProductType). Replaces free-text productType strings as the source
-- of truth for "which boutiques exist" — Category/StoreSettings/Product/
-- Order/Sale/Client all reference StoreType.key below.
CREATE TABLE "StoreType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "themeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreType_key_key" ON "StoreType"("key");

-- Seed the two built-in presets. Confirmed via a read-only query before
-- writing this migration: every existing Category.productType/
-- StoreSettings.productType value in use today is either null, 'sport', or
-- 'cosmetique' — nothing else needs seeding.
INSERT INTO "StoreType" ("id", "key", "label", "themeId") VALUES
    ('storetype_sport', 'sport', 'Sport', 'default'),
    ('storetype_cosmetique', 'cosmetique', 'Cosmétique', 'rose');

-- Category.productType stays nullable (generic = shown regardless of
-- active type) — just gains a FK now that StoreType exists.
ALTER TABLE "Category" ADD CONSTRAINT "Category_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product/Order/Sale/Client each get a required productType: add nullable,
-- backfill every existing row to 'cosmetique' (the currently active type —
-- confirmed counts: 11 products, 19 orders, 11 sales, 1 client, none of
-- which have any determinable type today), then lock it down.
ALTER TABLE "Product" ADD COLUMN "productType" TEXT;
UPDATE "Product" SET "productType" = 'cosmetique';
ALTER TABLE "Product" ALTER COLUMN "productType" SET NOT NULL;
ALTER TABLE "Product" ADD CONSTRAINT "Product_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

ALTER TABLE "Order" ADD COLUMN "productType" TEXT;
UPDATE "Order" SET "productType" = 'cosmetique';
ALTER TABLE "Order" ALTER COLUMN "productType" SET NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Order_productType_idx" ON "Order"("productType");

ALTER TABLE "Sale" ADD COLUMN "productType" TEXT;
UPDATE "Sale" SET "productType" = 'cosmetique';
ALTER TABLE "Sale" ALTER COLUMN "productType" SET NOT NULL;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Sale_productType_idx" ON "Sale"("productType");

ALTER TABLE "Client" ADD COLUMN "productType" TEXT;
UPDATE "Client" SET "productType" = 'cosmetique';
ALTER TABLE "Client" ALTER COLUMN "productType" SET NOT NULL;
ALTER TABLE "Client" ADD CONSTRAINT "Client_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Client_productType_idx" ON "Client"("productType");
