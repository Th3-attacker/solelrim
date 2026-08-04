-- Category was the only tenant-scoped model missing an index on
-- productType, despite being filtered on it in getAllCategories and
-- getAllShopCategories.
CREATE INDEX "Category_productType_idx" ON "Category"("productType");
