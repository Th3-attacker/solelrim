import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { FavoritesSortedGrid } from "@/components/shop/favorites-sorted-grid";
import { FeaturedShowcase } from "@/components/shop/featured-showcase";
import { HeroSection } from "@/components/shop/hero-section";
import { ProductCard } from "@/components/shop/product-card";
import { SectionTitle } from "@/components/shop/section-title";
import { TrustBadges } from "@/components/shop/trust-badges";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import {
  filterByColor,
  filterByPriceBucket,
  getAllCatalogColors,
  sortProducts,
} from "@/lib/shop/filters";
import { getTranslations } from "next-intl/server";

export default async function ShopHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeType: string }>;
  searchParams: Promise<{
    category?: string;
    sort?: string;
    price?: string;
    color?: string;
    q?: string;
  }>;
}) {
  const [{ storeType }, { category, sort, price, color, q }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [t, boutique] = await Promise.all([
    getTranslations("shop"),
    getPublicBoutiqueSettings(storeType),
  ]);
  const [allProducts, categories] = await Promise.all([
    getActiveProducts(storeType),
    getAllShopCategories(storeType),
  ]);

  let displayedProducts = category
    ? allProducts.filter((p) => p.categoryId === category)
    : allProducts;
  if (q) {
    const query = q.trim().toLowerCase();
    displayedProducts = displayedProducts.filter((p) =>
      p.name.toLowerCase().includes(query),
    );
  }
  if (color) {
    displayedProducts = filterByColor(displayedProducts, color);
  }
  if (price) {
    displayedProducts = filterByPriceBucket(displayedProducts, price);
  }
  displayedProducts = sortProducts(displayedProducts, sort);

  const catalogColors = getAllCatalogColors(allProducts);
  const featuredProducts = allProducts.filter((p) => p.isFeatured).slice(0, 5);

  return (
    <div className="flex flex-col gap-14">
      <HeroSection settings={boutique} />

      <CategoryFilters
        categoryBreadcrumb={
          <CategoryFilterBar
            storeType={storeType}
            categories={categories}
            activeCategoryId={category}
          />
        }
        colors={catalogColors}
        categoryId={category}
      />

      <div id="catalog" className="flex scroll-mt-20 flex-col gap-6">
        <SectionTitle>{t("allProductsTitle")}</SectionTitle>

        {displayedProducts.length === 0 ? (
          <p className="text-paragraph-md text-muted-foreground">{t("noProducts")}</p>
        ) : (
          <FavoritesSortedGrid ids={displayedProducts.map((p) => p.id)}>
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                storeType={storeType}
                priority={index < 4}
              />
            ))}
          </FavoritesSortedGrid>
        )}
      </div>

      <FeaturedShowcase products={featuredProducts} storeType={storeType} />

      <TrustBadges />
    </div>
  );
}
