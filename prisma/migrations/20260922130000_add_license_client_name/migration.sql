-- The license contract's section 34 (see
-- components/settings/license-contract-document.tsx) needs the Client's
-- legal name/raison sociale, distinct from StoreType.label (the boutique's
-- commercial display name) — a superadmin fills this in when drafting the
-- contract, null until then.
--
-- Also drops the temporary DEFAULT now() the previous migration put on
-- updatedAt only to satisfy NOT NULL for pre-existing rows — Prisma's
-- @updatedAt directive already sets it on every create/update going
-- forward, so the DB-level default was never needed after that one-time
-- backfill.
ALTER TABLE "StoreType" ADD COLUMN     "licenseClientName" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
