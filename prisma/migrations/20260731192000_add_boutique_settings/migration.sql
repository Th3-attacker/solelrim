-- Per-boutique contact/branding move from the StoreSettings singleton onto
-- StoreType (already one row per boutique). Backfill every StoreType from
-- today's global singleton as a safe non-blank starting point — these
-- values are in practice the Sport boutique's (only real activity so far);
-- review/replace them for Cosmétique once it has real products.
ALTER TABLE "StoreType" ADD COLUMN "bankilyNumber" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "masrivyNumber" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "adminWhatsappNumber" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "paymentInstructions" TEXT;
ALTER TABLE "StoreType" ADD COLUMN "logoStoragePath" TEXT;

UPDATE "StoreType" SET
  "bankilyNumber" = (SELECT "bankilyNumber" FROM "StoreSettings" WHERE id = 'singleton'),
  "masrivyNumber" = (SELECT "masrivyNumber" FROM "StoreSettings" WHERE id = 'singleton'),
  "adminWhatsappNumber" = (SELECT "adminWhatsappNumber" FROM "StoreSettings" WHERE id = 'singleton'),
  "paymentInstructions" = (SELECT "paymentInstructions" FROM "StoreSettings" WHERE id = 'singleton'),
  "logoStoragePath" = (SELECT "logoStoragePath" FROM "StoreSettings" WHERE id = 'singleton');

-- Social links become an extensible per-boutique list instead of 3 fixed
-- columns. Nothing to backfill: instagramUrl/facebookUrl/tiktokUrl are all
-- empty on the singleton today (verified read-only).
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialLink_productType_idx" ON "SocialLink"("productType");
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "SocialLink" FOR SELECT TO anon, authenticated USING (true);

-- Old singleton columns are superseded now that every consumer reads the
-- live boutique's own StoreType/SocialLink instead (see
-- lib/queries/settings.ts's getPublicBoutique).
ALTER TABLE "StoreSettings" DROP COLUMN "bankilyNumber";
ALTER TABLE "StoreSettings" DROP COLUMN "masrivyNumber";
ALTER TABLE "StoreSettings" DROP COLUMN "adminWhatsappNumber";
ALTER TABLE "StoreSettings" DROP COLUMN "paymentInstructions";
ALTER TABLE "StoreSettings" DROP COLUMN "logoStoragePath";
ALTER TABLE "StoreSettings" DROP COLUMN "instagramUrl";
ALTER TABLE "StoreSettings" DROP COLUMN "facebookUrl";
ALTER TABLE "StoreSettings" DROP COLUMN "tiktokUrl";
