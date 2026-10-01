-- Extends StoreType with a real license model (type/status/started-at, on
-- top of the pre-existing licenseExpiresAt) and a first per-boutique
-- feature flag (couponsEnabled). See lib/shop/license.ts for how the four
-- license columns combine into one effective state, and
-- lib/shop/admin-scope.ts (requireWritableAdminScope) for where it's
-- actually enforced — this migration only adds the columns.
--
-- Every existing boutique defaults to licenseStatus ACTIVE with whatever
-- licenseExpiresAt it already had (often null = unrestricted) and
-- couponsEnabled true, so this migration changes no behavior by itself.

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('MONTHLY', 'YEARLY', 'PERPETUAL');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- AlterTable
-- updatedAt gets DEFAULT now() only to satisfy NOT NULL for rows that
-- already exist — every write going forward sets it via Prisma's
-- @updatedAt directive, same as every other @updatedAt column in this
-- schema (Product.updatedAt, ProductVariant.updatedAt, ...).
ALTER TABLE "StoreType"
  ADD COLUMN     "couponsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN     "licenseStartedAt" TIMESTAMP(3),
  ADD COLUMN     "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN     "licenseType" "LicenseType" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
