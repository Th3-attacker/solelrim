-- "One promo redemption per phone" (findValidPromoCode in
-- lib/shop/promo-code.ts) was enforced with a plain SELECT-then-decide
-- check inside submitOrder's transaction, with no corresponding DB
-- constraint — unlike the stock and PromoCode.usedCount guards right next
-- to it in the same function, which close the same kind of race via a
-- conditional UPDATE. Two concurrent submitOrder calls for the same
-- phone + promo code could both pass the read before either commits,
-- redeeming the code twice.
--
-- A partial unique index closes it at the database level instead: at most
-- one non-terminal (not REJECTED/CANCELLED) order per (promoCodeId,
-- customerPhone) pair. submitOrder now catches the resulting P2002 on
-- Order.create and returns "alreadyUsed" instead of retrying it as a
-- reference collision (see lib/actions/orders.ts).
--
-- No existing data violates this (verified read-only: no phone has two
-- non-terminal orders against the same promo code today).
CREATE UNIQUE INDEX "Order_promoCodeId_customerPhone_active_key"
  ON "Order" ("promoCodeId", "customerPhone")
  WHERE "promoCodeId" IS NOT NULL AND "status" NOT IN ('REJECTED', 'CANCELLED');
