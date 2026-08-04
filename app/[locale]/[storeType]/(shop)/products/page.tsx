import { CategoryFilterBar } from "@/components/shop/category-filter-bar";
import { CategoryFilters } from "@/components/shop/category-filters";
import { ProductCard } from "@/components/shop/product-card";
import { StateMessage } from "@/components/ui/state-message";
import { PackageSearch } from "lucide-react";
import { getActiveProducts, getAllShopCategories } from "@/lib/queries/shop";
import {
  filterByColor,
  filterByPriceBucket,
  getAllCatalogColors,
  sortProducts,
} from "@/lib/shop/filters";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("shop");
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-heading-lg text-balance sm:text-heading-xl">
        {t("allProductsTitle")}
      </h1>

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

      <div id="catalog" className="scroll-mt-20">
        {displayedProducts.length === 0 ? (
          <StateMessage icon={PackageSearch} title={t("noProducts")} />
        ) : (
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                storeType={storeType}
                priority={index < 4}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
