import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MagnifyingGlass, Package } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { ProductCard } from "@/components/shop/product-card";
import { ListPagination } from "@/components/ui/list-pagination";
import { StateMessage } from "@/components/ui/state-message";
import {
  getAllShopCategories,
  getCatalogueColors,
  getFilteredProductsPage,
} from "@/lib/queries/shop";
import { resolveMetadata } from "@/lib/seo/head";
import { catalogueFiltersFromSearch } from "@/lib/shop/filters";
import { toPageNumber } from "@/lib/shop/pagination";
import { getShopPageContext, shopPageMetadata } from "@/src/server/shop";
import { optionalStringFields, routeFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/products/page.tsx.

const CATALOGUE_PAGE_SIZE = 24;
const SEARCH_KEYS = ["category", "sort", "price", "color", "q", "page"] as const;

// The catalog is a real, distinct, filterable page (not a redirect — see
// the note in src/routes/sitemap[.]xml.ts) and deserves its own title
// instead of inheriting the boutique's home-page seoTitle from the layout.
const loadProducts = createServerFn({ method: "GET" })
  .validator(routeFields(["storeType"], SEARCH_KEYS))
  .handler(async ({ data: { storeType, ...search } }) => {
    const context = await getShopPageContext(storeType);
    const { tShop: t, siteName, basePath, boutique } = context;
    const { category, color, price, q } = search;
    const hasFilters = Boolean(category || color || price || q?.trim());
    const page = toPageNumber(search.page ? Number(search.page) : undefined);

    // Filtered, sorted and paginated in the database, with the same SQL as the
    // app's catalogue (lib/queries/catalogue-filters.ts). The color list stays
    // the whole catalogue's, whatever is filtered.
    const [{ items, total }, categories, catalogColors] = await Promise.all([
      getFilteredProductsPage(catalogueFiltersFromSearch(storeType, search), {
        page,
        pageSize: CATALOGUE_PAGE_SIZE,
      }),
      getAllShopCategories(storeType),
      getCatalogueColors(storeType),
    ]);

    const title = `${siteName} — ${t("allProductsTitle")}`;
    const description = t("allProductsMetaDescription");
    const keywords = [...new Set([siteName, ...categories.map((c) => c.name)])];

    return {
      meta: resolveMetadata(
        shopPageMetadata(context, { storeType, path: "/products", title, description, keywords }),
      ),
      basePath,
      cardVariant: boutique.cardVariant,
      search: { category, sort: search.sort, price, color, q },
      hasFilters,
      page,
      products: items,
      total,
      categories,
      catalogColors,
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/products/")({
  validateSearch: optionalStringFields(...SEARCH_KEYS),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => loadProducts({ data: { storeType: params.storeType, ...deps } }),
  component: ProductsPage,
  ...shopPageBoundaries,
});

function ProductsPage() {
  const {
    basePath,
    cardVariant,
    search,
    hasFilters,
    page,
    products,
    total,
    categories,
    catalogColors,
  } = Route.useLoaderData();
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");

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
            activeCategoryId={search.category}
          />
        }
        colors={catalogColors}
        categoryId={search.category}
      />

      <div id="catalog" className="scroll-mt-20">
        {products.length === 0 ? (
          <StateMessage
            icon={hasFilters ? MagnifyingGlass : Package}
            title={hasFilters ? tCommon("noResults") : t("noProducts")}
          />
        ) : (
          <ul
            role="list"
            className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4"
          >
            {products.map((product, index) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  basePath={basePath}
                  priority={index < 4}
                  cardVariant={cardVariant}
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
        searchParams={search}
      />
    </div>
  );
}
