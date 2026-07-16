import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { FavoritesSortedGrid } from "@/components/shop/favorites-sorted-grid";
import { HeroSection } from "@/components/shop/hero-section";
import { MobileCategoryToggle } from "@/components/shop/mobile-category-toggle";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFilters } from "@/components/shop/product-filters";
import { TrustBadges } from "@/components/shop/trust-badges";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
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
  const [t, allProducts, categories] = await Promise.all([
    getTranslations("shop"),
    getActiveProducts(),
    getAllShopCategories(),
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

  return (
    <div className="flex flex-col gap-14">
      <HeroSection products={allProducts} />

      <div className="hidden items-center justify-between gap-4 md:flex">
        <CategoryFilterBar categories={categories} activeCategoryId={category} />
        <ProductFilters colors={catalogColors} categoryId={category} />
      </div>

      <div className="md:hidden">
        <MobileCategoryToggle
          filters={<ProductFilters colors={catalogColors} categoryId={category} />}
        >
          <CategoryFilterBar categories={categories} activeCategoryId={category} />
        </MobileCategoryToggle>
      </div>

      <div id="catalog" className="flex scroll-mt-20 flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full bg-primary" />
          <h2 className="text-xl font-semibold tracking-tight">
            {t("allProductsTitle")}
          </h2>
        </div>

        {displayedProducts.length === 0 ? (
          <p className="text-muted-foreground">{t("noProducts")}</p>
        ) : (
          <FavoritesSortedGrid ids={displayedProducts.map((p) => p.id)}>
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </FavoritesSortedGrid>
        )}
      </div>

      <TrustBadges />
    </div>
  );
}
