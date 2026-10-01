-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "refundedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedByEmail" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "amount" DECIMAL(10,2),
    "paymentMethod" TEXT,
    "walletProvider" TEXT,
    "cashSessionId" TEXT,
    "loyaltyPointsTakenBack" INTEGER NOT NULL DEFAULT 0,
    "loyaltyPointsReturned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundRequest_productType_status_createdAt_idx" ON "RefundRequest"("productType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_saleId_idx" ON "RefundRequest"("saleId");

-- CreateIndex
CREATE INDEX "RefundRequest_cashSessionId_idx" ON "RefundRequest"("cashSessionId");

-- CreateIndex
CREATE INDEX "RefundItem_requestId_idx" ON "RefundItem"("requestId");

-- CreateIndex
CREATE INDEX "RefundItem_saleItemId_idx" ON "RefundItem"("saleItemId");

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One pending request per sale: a second one would race the first for the
-- same units. Decided requests (approved/rejected) are unrestricted.
CREATE UNIQUE INDEX "RefundRequest_one_pending_per_sale" ON "RefundRequest"("saleId") WHERE "status" = 'PENDING';

ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_refundedQuantity_check" CHECK ("refundedQuantity" >= 0 AND "refundedQuantity" <= "quantity");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_refundedAmount_check" CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "total");

-- Only reached through Prisma (service role); never through the public API.
ALTER TABLE "RefundRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefundItem" ENABLE ROW LEVEL SECURITY;
