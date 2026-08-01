-- Category.name was globally unique across every boutique, which made
-- sense with one shared admin — but now that boutique admins independently
-- manage their own categories, two different boutiques must each be able
-- to have their own "Accessoires". Replace the single global unique
-- constraint with two partial ones: generic (productType IS NULL) names
-- stay unique among themselves, and each boutique's own names are unique
-- only within that boutique. Postgres treats NULL as always-distinct in a
-- normal composite unique index, so a plain @@unique([name, productType])
-- would NOT actually enforce uniqueness among generic categories — hence
-- two explicit partial indexes instead of one.
--
-- No existing data violates either constraint (verified read-only: no
-- duplicate names within the same scope today).
DROP INDEX "Category_name_key";

CREATE UNIQUE INDEX "Category_name_generic_key" ON "Category"("name") WHERE "productType" IS NULL;
CREATE UNIQUE INDEX "Category_name_productType_key" ON "Category"("name", "productType") WHERE "productType" IS NOT NULL;
