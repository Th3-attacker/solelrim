import { getTranslations } from "next-intl/server";
import { Plus, Package, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { getAllProducts, getAllCategories, PRODUCTS_PAGE_SIZE } from "@/lib/queries/products";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductsTable } from "@/components/products/products-table";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const categoryId = typeof params.category === "string" ? params.category : undefined;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
  const hasFilters = Boolean(search || categoryId);

  const scope = await getAdminScope();
  const [t, tCommon, categories, { products, total }] = await Promise.all([
    getTranslations("products"),
    getTranslations("common"),
    getAllCategories(scope),
    getAllProducts(scope, { search, categoryId, page }),
  ]);

  return (
    <div className="flex flex-col gap-6">
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
        pageSize={PRODUCTS_PAGE_SIZE}
        total={total}
        basePath="/admin/products"
        searchParams={{ q: search, category: categoryId }}
      />
    </div>
  );
}
