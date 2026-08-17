-- One-time backfill for the stock-reservation-at-submission change (see
-- lib/actions/orders.ts submitOrder/confirmOrder). Before that change,
-- stock was reserved at admin confirmation, not at submission; now it's
-- reserved at submission and confirmOrder no longer touches stock at all.
-- Any order still PENDING at the moment this migration runs was created
-- under the old code path and never had its stock reserved — without this
-- backfill, those units could be confirmed here while also being sold to
-- someone else in the meantime.
--
-- Safe to run more than once, or against a database with no PENDING
-- orders — the UPDATE simply matches zero rows in that case. GREATEST(...,
-- 0) avoids going negative if a variant's real stock has already drifted
-- below what the order reserves (e.g. a manual in-store sale since).
UPDATE "ProductVariant" pv
SET stock = GREATEST(pv.stock - reserved.qty, 0)
FROM (
  SELECT oi."variantId" AS "variantId", SUM(oi.quantity) AS qty
  FROM "OrderItem" oi
  JOIN "Order" o ON o.id = oi."orderId"
  WHERE o.status = 'PENDING'
  GROUP BY oi."variantId"
) reserved
WHERE pv.id = reserved."variantId";
