import type { Metadata } from "next";
import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { ProductCard } from "@/components/shop/product-card";
import { StateMessage } from "@/components/ui/state-message";
import { Package, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getActiveProducts, getAllShopCategories, searchActiveProducts } from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStoreLogoUrl } from "@/lib/supabase/storage";
import {
  filterByColor,
  filterByPriceBucket,
  getAllCatalogColors,
  sortProducts,
} from "@/lib/shop/filters";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { buildSocialMetadata } from "@/lib/shop/metadata";
import { getLocale, getTranslations } from "next-intl/server";

// The catalog is a real, distinct, filterable page (not a redirect — see
// the corrected note in app/sitemap.ts) and deserves its own title instead
// of inheriting the boutique's home-page seoTitle from the layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string }>;
}): Promise<Metadata> {
  const { storeType } = await params;
  const [t, locale, boutique, categories] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
    getAllShopCategories(storeType),
  ]);
  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || t("siteName");
  const title = `${siteName} — ${t("allProductsTitle")}`;
  const description = t("allProductsMetaDescription");
  const imageUrl = boutique.logoStoragePath
    ? getStoreLogoUrl(boutique.logoStoragePath)
    : null;
  const keywords = [
    ...new Set([siteName, ...categories.map((category) => category.name)]),
  ];

  return {
    title,
    description,
    keywords,
    ...buildSocialMetadata({
      title,
      description,
      imageUrl,
      locale,
      domain: boutique.domain,
      storeKey: storeType,
      path: "/products",
    }),
  };
}



export default async function ProductsPage({
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
  const [t, tCommon, basePath, boutique] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getStorefrontBasePath(storeType),
    getPublicBoutiqueSettings(storeType),
  ]);
  const hasFilters = Boolean(category || color || price || q?.trim());
  const [allProducts, categories] = await Promise.all([
    getActiveProducts(storeType),
    getAllShopCategories(storeType),
  ]);

  // A text query is answered by the database (accent-insensitive ILIKE,
  // bounded by LIMIT) instead of scanning allProducts in JS — that scan
  // would otherwise re-run, unbounded, on every search as the catalog
  // grows. allProducts itself still gets fetched unconditionally for
  // catalogColors below, which intentionally reflects the whole catalog
  // regardless of the current filters.
  let displayedProducts = q?.trim()
    ? await searchActiveProducts(storeType, q, { categoryId: category })
    : category
      ? allProducts.filter((p) => p.categoryId === category)
      : allProducts;
  if (color) {
    displayedProducts = filterByColor(displayedProducts, color);
  }
  if (price) {
    displayedProducts = filterByPriceBucket(displayedProducts, price);
  }
  displayedProducts = sortProducts(displayedProducts, sort);

  const catalogColors = getAllCatalogColors(allProducts);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-heading-lg text-balance sm:text-heading-xl">
        {t("allProductsTitle")}
      </h1>

      <CategoryFilters
        categoryBreadcrumb={
          <CategoryFilterBar
            basePath={basePath}
            categories={categories}
            activeCategoryId={category}
          />
        }
        colors={catalogColors}
        categoryId={category}
      />

      <div id="catalog" className="scroll-mt-20">
        {displayedProducts.length === 0 ? (
          <StateMessage
            icon={hasFilters ? MagnifyingGlass : Package}
            title={hasFilters ? tCommon("noResults") : t("noProducts")}
          />
        ) : (
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                basePath={basePath}
                priority={index < 4}
                cardVariant={boutique.cardVariant}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
