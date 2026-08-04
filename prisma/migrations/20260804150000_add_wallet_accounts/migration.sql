-- Bankily/Masrivy move from two fixed StoreType columns to a repeatable,
-- ordered list (mirrors SocialLink) — the boutique admin can now add or
-- remove wallet numbers instead of being capped at exactly one per
-- provider.
CREATE TYPE "WalletProvider" AS ENUM ('BANKILY', 'MASRIVY');

CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "provider" "WalletProvider" NOT NULL,
    "number" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalletAccount_productType_idx" ON "WalletAccount"("productType");
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same posture as SocialLink: public-facing at checkout, so RLS stays on
-- with an explicit read policy instead of the catalog tables' default-deny.
ALTER TABLE "WalletAccount" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "WalletAccount" FOR SELECT TO anon, authenticated USING (true);

-- Backfill existing single numbers into the new list, preserving the order
-- they used to render in (Bankily then Masrivy).
INSERT INTO "WalletAccount" ("id", "productType", "provider", "number", "position", "createdAt")
SELECT 'wallet_' || "key" || '_bankily', "key", 'BANKILY', "bankilyNumber", 0, CURRENT_TIMESTAMP
FROM "StoreType"
WHERE "bankilyNumber" IS NOT NULL AND "bankilyNumber" != '';

INSERT INTO "WalletAccount" ("id", "productType", "provider", "number", "position", "createdAt")
SELECT 'wallet_' || "key" || '_masrivy', "key", 'MASRIVY', "masrivyNumber", 1, CURRENT_TIMESTAMP
FROM "StoreType"
WHERE "masrivyNumber" IS NOT NULL AND "masrivyNumber" != '';

ALTER TABLE "StoreType" DROP COLUMN "bankilyNumber";
ALTER TABLE "StoreType" DROP COLUMN "masrivyNumber";
