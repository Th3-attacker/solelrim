-- A SELLER is locked to exactly one boutique, same as a BOUTIQUE_ADMIN —
-- extend the DB-level role/productType check (20260731190000) to cover it.
ALTER TABLE "AdminUser" DROP CONSTRAINT "AdminUser_role_productType_check";
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_role_productType_check" CHECK (
  ("role" = 'SUPERADMIN' AND "productType" IS NULL) OR
  ("role" IN ('BOUTIQUE_ADMIN', 'SELLER') AND "productType" IS NOT NULL)
);

-- Per-boutique cap on SELLER accounts a boutique admin can create;
-- only a superadmin can raise it.
ALTER TABLE "StoreType" ADD COLUMN "sellerQuota" INTEGER NOT NULL DEFAULT 2;
