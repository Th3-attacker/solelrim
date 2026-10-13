import type { Metadata } from "next";
import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { ProductCard } from "@/components/shop/product-card";
import { StateMessage } from "@/components/ui/state-message";
import { Package, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  getAllShopCategories,
  getCatalogueColors,
  getFilteredProductsPage,
} from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getStoreLogoUrl } from "@/lib/supabase/storage";
import { catalogueFiltersFromSearch } from "@/lib/shop/filters";
import { toPageNumber } from "@/lib/shop/pagination";
import { getStorefrontBasePath } from "@/lib/services/storefront-path";
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
  const imageUrl = boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null;
  const keywords = [...new Set([siteName, ...categories.map((category) => category.name)])];

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
      siteName,
    }),
  };
}

const CATALOGUE_PAGE_SIZE = 24;

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
    page?: string;
  }>;
}) {
  const [{ storeType }, search] = await Promise.all([params, searchParams]);
  const { category, color, price, q } = search;
  const [t, tCommon, basePath, boutique] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getStorefrontBasePath(storeType),
    getPublicBoutiqueSettings(storeType),
  ]);
  const hasFilters = Boolean(category || color || price || q?.trim());
  const page = toPageNumber(search.page ? Number(search.page) : undefined);

  // Filtered, sorted and paginated in the database, with the same SQL as the
  // app's catalogue (lib/queries/catalogue-filters.ts). The color list stays
  // the whole catalogue's, whatever is filtered.
  const [{ items: displayedProducts, total }, categories, catalogColors] = await Promise.all([
    getFilteredProductsPage(catalogueFiltersFromSearch(storeType, search), {
      page,
      pageSize: CATALOGUE_PAGE_SIZE,
    }),
    getAllShopCategories(storeType),
    getCatalogueColors(storeType),
  ]);

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
          <ul
            role="list"
            className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4"
          >
            {displayedProducts.map((product, index) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  basePath={basePath}
                  priority={index < 4}
                  cardVariant={boutique.cardVariant}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ListPagination
        page={page}
        pageSize={CATALOGUE_PAGE_SIZE}
        total={total}
        basePath={`${basePath}/products`}
        searchParams={{ category, sort: search.sort, price, color, q }}
      />
    </div>
  );
}
