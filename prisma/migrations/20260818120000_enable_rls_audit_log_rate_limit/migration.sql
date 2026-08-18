-- Two tables slipped through the original RLS pass (20260720111215): both
-- were created afterwards and never got ENABLE ROW LEVEL SECURITY, so the
-- Supabase anon/authenticated PostgREST roles have had full read (and
-- likely write) access to them via the public anon key ever since —
-- entirely bypassing this app, same class of gap the original migration
-- closed for every other table.
--
-- AdminAuditLog holds admin emails and actions; RateLimitHit holds
-- rate-limit keys (e.g. "login:<ip>"). Neither should be reachable from
-- the anon key. Same fix as before: enable RLS with zero policies, which
-- default-denies anon/authenticated while leaving Prisma (postgres role,
-- BYPASSRLS) completely unaffected.
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitHit" ENABLE ROW LEVEL SECURITY;
