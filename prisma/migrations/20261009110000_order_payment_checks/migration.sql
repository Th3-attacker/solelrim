-- Two checks against fake payment screenshots (see submitOrder):
-- the wallet's transaction id, unique per boutique among live orders, and a
-- SHA-256 of the screenshot so the admin sees when one image is reused.
ALTER TABLE "Order" ADD COLUMN "paymentTransactionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentProofHash" TEXT;

-- At most one non-terminal order per (boutique, transaction id). A rejected or
-- cancelled order frees its id, so the customer can place the order again.
CREATE UNIQUE INDEX "Order_productType_paymentTransactionId_active_key"
  ON "Order" ("productType", "paymentTransactionId")
  WHERE "paymentTransactionId" IS NOT NULL AND "status" NOT IN ('REJECTED', 'CANCELLED');

CREATE INDEX "Order_paymentProofHash_idx" ON "Order"("paymentProofHash");
