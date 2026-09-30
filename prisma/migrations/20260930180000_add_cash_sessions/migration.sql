-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashSessionId" TEXT;

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "sellerId" TEXT,
    "sellerEmail" TEXT NOT NULL,
    "sellerRole" "AdminRole" NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "expectedCash" DECIMAL(10,2),
    "countedCash" DECIMAL(10,2),
    "cashDifference" DECIMAL(10,2),
    "closingNote" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDayClosure" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "closedById" TEXT,
    "closedByEmail" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionCount" INTEGER NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "salesTotal" DECIMAL(12,2) NOT NULL,
    "expectedCash" DECIMAL(12,2) NOT NULL,
    "countedCash" DECIMAL(12,2) NOT NULL,
    "cashDifference" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "StoreDayClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_productType_businessDate_idx" ON "CashSession"("productType", "businessDate");

-- CreateIndex
CREATE INDEX "CashSession_sellerId_openedAt_idx" ON "CashSession"("sellerId", "openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_sessionId_idx" ON "CashMovement"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDayClosure_productType_businessDate_key" ON "StoreDayClosure"("productType", "businessDate");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDayClosure" ADD CONSTRAINT "StoreDayClosure_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Sales are summed per session at every register view and close.
CREATE INDEX "Sale_cashSessionId_idx" ON "Sale"("cashSessionId");

-- One open till per seller at a time. Closed sessions are unrestricted.
CREATE UNIQUE INDEX "CashSession_one_open_per_seller" ON "CashSession"("sellerId") WHERE "status" = 'OPEN';

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openingFloat_check" CHECK ("openingFloat" >= 0);
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_countedCash_check" CHECK ("countedCash" IS NULL OR "countedCash" >= 0);
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_check" CHECK ("amount" > 0);

-- Only reached through Prisma (service role); never through the public API.
ALTER TABLE "CashSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreDayClosure" ENABLE ROW LEVEL SECURITY;
