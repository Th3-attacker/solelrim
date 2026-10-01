-- In-store checkout (#166): who recorded each sale, which wallet the
-- money went to (a snapshot, not a foreign key), and the cash handed over.
ALTER TABLE "Sale" ADD COLUMN     "amountReceived" DECIMAL(10,2),
ADD COLUMN     "sellerId" TEXT,
ADD COLUMN     "walletProvider" TEXT;

CREATE INDEX "Sale_sellerId_idx" ON "Sale"("sellerId");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
