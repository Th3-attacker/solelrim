-- Role-based access control. Links a Supabase auth user (auth.users.id,
-- out of Prisma's reach — no multi-schema config) to a role and, for a
-- boutique admin, exactly one StoreType they're permanently locked to.
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'BOUTIQUE_ADMIN');

CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "productType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_supabaseUserId_key" ON "AdminUser"("supabaseUserId");
CREATE INDEX "AdminUser_productType_idx" ON "AdminUser"("productType");

ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Belt-and-suspenders at the DB level, not just app code: a superadmin is
-- never scoped, a boutique admin always has exactly one boutique.
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_role_productType_check" CHECK (
  ("role" = 'SUPERADMIN' AND "productType" IS NULL) OR
  ("role" = 'BOUTIQUE_ADMIN' AND "productType" IS NOT NULL)
);

-- This table is literally "who has what access" — must never be readable
-- via the anon/authenticated PostgREST roles. Same posture as every other
-- non-catalog table (see 20260720111215): RLS on, zero policies, Prisma
-- (postgres role, BYPASSRLS) unaffected.
ALTER TABLE "AdminUser" ENABLE ROW LEVEL SECURITY;

-- StoreType never got this treatment when it was created (20260731170000)
-- — it's non-sensitive catalog metadata like Category, so it gets the same
-- public-read policy Category/Product already have, fixing that gap now
-- that this migration is already touching StoreType's neighborhood.
ALTER TABLE "StoreType" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "StoreType" FOR SELECT TO anon, authenticated USING (true);
