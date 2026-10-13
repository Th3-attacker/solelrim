-- Same RLS pass every new table gets (see migration 20260720111215), missed
-- when PushToken was added: without it the Supabase anon key could read every
-- customer's Expo push token through PostgREST. Default-deny for the
-- anon/authenticated roles, no effect on Prisma (postgres role, BYPASSRLS).
ALTER TABLE "PushToken" ENABLE ROW LEVEL SECURITY;
