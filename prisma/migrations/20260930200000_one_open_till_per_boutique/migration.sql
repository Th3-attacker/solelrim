-- One open till per seller *per boutique*: a superadmin sells in several
-- boutiques, and every till lookup is already scoped to the boutique, so a
-- till left open in one must not block opening one in another.
DROP INDEX "CashSession_one_open_per_seller";
CREATE UNIQUE INDEX "CashSession_one_open_per_seller" ON "CashSession"("sellerId", "productType") WHERE "status" = 'OPEN';
