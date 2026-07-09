import { getTranslations } from "next-intl/server";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getPriceRange } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import { ProductCard } from "@/components/shop/product-card";
import { ProductShelf } from "@/components/shop/product-shelf";
import { CategoryTiles } from "@/components/shop/category-tiles";
import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategorySelect } from "@/components/shop/category-select";
import { HeroSection } from "@/components/shop/hero-section";
import { TrustBadges } from "@/components/shop/trust-badges";

export default async function ShopHomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [t, allProducts, categories] = await Promise.all([
    getTranslations("shop"),
    getActiveProducts(),
    getAllShopCategories(),
  ]);

  const displayedProducts = category
    ? allProducts.filter((p) => p.categoryId === category)
    : allProducts;

  const bestSellers = allProducts.filter((p) => p.isFeatured).slice(0, 8);
  const newArrivals = allProducts
    .filter((p) => isNewProduct(p.createdAt))
    .slice(0, 8);
  const promos = allProducts
    .filter((p) => {
      const { min } = getPriceRange(p.variants, p.basePrice);
      return isPromo(p.compareAtPrice, min);
    })
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-14">
      <HeroSection />

      <CategoryFilterBar categories={categories} activeCategoryId={category} />

      <CategoryTiles categories={categories} />

      <ProductShelf title={t("bestSellerBadge")} products={bestSellers} />
      <ProductShelf title={t("newBadge")} products={newArrivals} />
      <ProductShelf title={t("promoBadge")} products={promos} />

      <TrustBadges />

      <div id="catalog" className="flex scroll-mt-20 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-primary" />
            <h2 className="text-xl font-semibold tracking-tight">
              {t("allProductsTitle")}
            </h2>
          </div>
          <CategorySelect categories={categories} activeCategoryId={category} />
        </div>

        {displayedProducts.length === 0 ? (
          <p className="text-muted-foreground">{t("noProducts")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
