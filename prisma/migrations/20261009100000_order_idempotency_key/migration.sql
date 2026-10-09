-- AlterTable
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_productType_idempotencyKey_key" ON "Order"("productType", "idempotencyKey");
