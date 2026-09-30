-- Opt-in loyalty card (#168): the client's phone is the card, points live
-- on the client, and each sale records what it earned/spent so a
-- cancellation can reverse it exactly.
ALTER TABLE "Client" ADD COLUMN     "loyaltyEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Sale" ADD COLUMN     "loyaltyDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StoreType" ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loyaltyRewardPoints" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "loyaltyRewardValue" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "loyaltySpendPerPoint" INTEGER NOT NULL DEFAULT 100;

-- One loyalty card per phone per boutique — but only among *enrolled*
-- clients, so admin-created client records that happen to share a phone
-- (allowed today) don't block this migration or the client form. Prisma's
-- schema DSL can't express a partial index, so it lives here only.
CREATE UNIQUE INDEX "Client_loyalty_phone_key"
  ON "Client" ("productType", "phone")
  WHERE "loyaltyEnrolledAt" IS NOT NULL;

-- Points can never go negative, whatever the code path.
ALTER TABLE "Client" ADD CONSTRAINT "Client_loyaltyPoints_nonnegative" CHECK ("loyaltyPoints" >= 0);
