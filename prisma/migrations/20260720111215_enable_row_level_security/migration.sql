-- Enable Row Level Security on every table in `public`.
--
-- Prisma connects as the `postgres` role, which owns every table here and
-- has BYPASSRLS — so this has zero effect on the app itself. What it does
-- change: the Supabase anon/authenticated PostgREST roles, which do NOT
-- have BYPASSRLS, currently have full SELECT (and likely write) access to
-- every table via the public anon key, entirely bypassing this app.
--
-- Catalog tables get an explicit public read policy (they're already
-- public in the storefront). Everything else gets RLS enabled with no
-- policies at all, which is a default-deny for anon/authenticated while
-- leaving Prisma unaffected.

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON "Category"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "Product"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "ProductVariant"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "ProductImage"
  FOR SELECT TO anon, authenticated USING (true);

-- No policies below this line: RLS enabled with zero policies denies all
-- access to anon/authenticated (SELECT/INSERT/UPDATE/DELETE), while the
-- Prisma connection (postgres, BYPASSRLS) continues to work unchanged.
-- (_prisma_migrations is left alone: Prisma's own shadow-DB migration
-- replay chokes on RLS-altering its own bookkeeping table, and it holds
-- no application data — low value, not worth the fight.)
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreSettings" ENABLE ROW LEVEL SECURITY;
