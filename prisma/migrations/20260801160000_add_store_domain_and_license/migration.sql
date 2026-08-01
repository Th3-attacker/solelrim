-- Infrastructure-level, superadmin-only additions to StoreType: a custom
-- public domain (proxy.ts routes it straight to this boutique) and a
-- manually-managed license expiration (purely a visual warning, see
-- lib/shop/license.ts — nothing is ever blocked by it). Both nullable and
-- unset by default, so existing boutiques are unaffected until a superadmin
-- explicitly configures either.
ALTER TABLE "StoreType" ADD COLUMN "domain" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "licenseExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StoreType_domain_key" ON "StoreType"("domain");
