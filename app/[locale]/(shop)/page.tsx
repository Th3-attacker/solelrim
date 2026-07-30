import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { FavoritesSortedGrid } from "@/components/shop/favorites-sorted-grid";
import { FeaturedShowcase } from "@/components/shop/featured-showcase";
import { HeroSection } from "@/components/shop/hero-section";
import { ProductCard } from "@/components/shop/product-card";
import { SectionTitle } from "@/components/shop/section-title";
import { TrustBadges } from "@/components/shop/trust-badges";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import { getStoreSettings } from "@/lib/queries/settings";
import {
  filterByColor,
  filterByPriceBucket,
  getAllCatalogColors,
  sortProducts,
} from "@/lib/shop/filters";
import { getTranslations } from "next-intl/server";

export default async function ShopHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    price?: string;
    color?: string;
    q?: string;
  }>;
}) {
  const { category, sort, price, color, q } = await searchParams;
  const [t, allProducts, categories, settings] = await Promise.all([
    getTranslations("shop"),
    getActiveProducts(),
    getAllShopCategories(),
    getStoreSettings(),
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
      <HeroSection settings={settings} />

      <CategoryFilters
        categoryBreadcrumb={
          <CategoryFilterBar categories={categories} activeCategoryId={category} />
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
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </FavoritesSortedGrid>
        )}
      </div>

      <FeaturedShowcase products={featuredProducts} />

      <TrustBadges />
    </div>
  );
}
