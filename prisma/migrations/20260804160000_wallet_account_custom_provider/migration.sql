-- Free-form provider name instead of a fixed Bankily/Masrivy enum — the
-- admin can name any wallet, not just the two originally hardcoded, and
-- optionally upload its own logo instead of relying on a bundled one.
ALTER TABLE "WalletAccount" ALTER COLUMN "provider" TYPE TEXT USING "provider"::TEXT;
ALTER TABLE "WalletAccount" ADD COLUMN "logoStoragePath" TEXT;
DROP TYPE "WalletProvider";

-- Nicer casing for rows backfilled from the old enum — everything from
-- here on is whatever the admin types directly.
UPDATE "WalletAccount" SET "provider" = 'Bankily' WHERE "provider" = 'BANKILY';
UPDATE "WalletAccount" SET "provider" = 'Masrivy' WHERE "provider" = 'MASRIVY';
