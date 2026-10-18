import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ProductsSkeleton } from "@/components/dashboard/page-skeletons";
import { pageInput } from "@/src/server/validators";
import { Plus, Package, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { getAllProducts, getAllCategories, PRODUCTS_PAGE_SIZE } from "@/lib/queries/products";
import { getAdminScope } from "@/lib/auth/scope";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductsTable } from "@/components/products/products-table";
import { SectionTabs } from "@/components/dashboard/section-tabs";

// Ex-app/[locale]/admin/(dashboard)/products/page.tsx.

const loadAdminProductsPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const params = data.search;
    const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
    const categoryId = typeof params.category === "string" ? params.category : undefined;
    const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
    const hasFilters = Boolean(search || categoryId);

    const scope = await getAdminScope();
    const [categories, { products, total }] = await Promise.all([
      getAllCategories(scope),
      getAllProducts(scope, { search, categoryId, page }),
    ]);

    // Les tailles de page viennent du serveur : leurs modules (lib/queries)
    // importent Prisma et n'ont rien à faire dans le navigateur.
    return {
      search,
      categoryId,
      page,
      hasFilters,
      categories,
      products,
      total,
      productsPageSize: PRODUCTS_PAGE_SIZE,
    };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/products/")({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => loadAdminProductsPage({ data: { search: deps.search } }),
  component: AdminProductsPage,
  ...adminPageBoundaries,
  pendingComponent: ProductsSkeleton,
});

function AdminProductsPage() {
  const { search, categoryId, page, hasFilters, categories, products, total, productsPageSize } =
    Route.useLoaderData();
  const t = useTranslations("products");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs group="catalog" current="/admin/products" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            {t("newProduct")}
          </Link>
        </Button>
      </div>

      <ProductFilters categories={categories} />

      {products.length === 0 ? (
        <StateMessage
          icon={hasFilters ? MagnifyingGlass : Package}
          title={hasFilters ? tCommon("noResults") : t("noProducts")}
        />
      ) : (
        <ProductsTable
          // Remounts (and so resets the internal bulk-selection Set) when
          // the visible list changes via search/filter/pagination —
          // otherwise a selection can silently keep referencing ids that
          // are no longer even on screen.
          key={`${search ?? ""}-${categoryId ?? ""}-${page}`}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            isActive: product.isActive,
            basePrice: product.basePrice.toNumber(),
            category: { name: product.category.name },
            variants: product.variants.map((v) => ({
              stock: v.stock,
              lowStockThreshold: v.lowStockThreshold,
            })),
          }))}
        />
      )}

      <ListPagination
        page={page}
        pageSize={productsPageSize}
        total={total}
        basePath="/admin/products"
        searchParams={{ q: search, category: categoryId }}
      />
    </div>
  );
}
