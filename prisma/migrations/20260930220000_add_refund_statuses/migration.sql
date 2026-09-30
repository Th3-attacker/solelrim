-- Enum additions in their own migration: a value added by ALTER TYPE can't
-- be used in the same transaction that adds it.
ALTER TYPE "SaleStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "SaleStatus" ADD VALUE 'REFUNDED';

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
