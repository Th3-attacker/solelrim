-- SOLAL's own contact info for the license contract's section 34
-- (components/settings/license-contract-document.tsx) — a single row,
-- editable by a superadmin (components/settings/solal-contact-form.tsx)
-- instead of a hardcoded constant.
CREATE TABLE "SolalContact" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolalContact_pkey" PRIMARY KEY ("id")
);

-- Same RLS pass every new table gets (see migration 20260720111215):
-- default-deny for the Supabase anon/authenticated PostgREST roles, no
-- effect on Prisma (postgres role, BYPASSRLS).
ALTER TABLE "SolalContact" ENABLE ROW LEVEL SECURITY;
