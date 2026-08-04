-- Personal (clientId set, matched by phone at checkout) or general
-- (clientId null) discount codes. Limits are independently optional:
-- expiresAt/maxUses null = no limit on that axis; isActive is the only
-- always-available way to retire a code.
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "clientId" TEXT,
    "productType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_productType_idx" ON "PromoCode"("productType");
CREATE INDEX "PromoCode_clientId_idx" ON "PromoCode"("clientId");

ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "promoCodeId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same posture as every other non-catalog table (see 20260720111215): RLS
-- on, zero policies — default-deny for anon/authenticated, Prisma
-- (postgres role, BYPASSRLS) unaffected. Codes must never be enumerable
-- via the public anon key.
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
