import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getProductById,
  getAllCategories,
  getCategoryById,
} from "@/lib/queries/products";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageManager } from "@/components/products/product-image-manager";
import type { ProductInput } from "@/lib/validation/product";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const productType = await getAdminScope();
  const [t, product] = await Promise.all([
    getTranslations("products"),
    getProductById(productId, productType),
  ]);

  if (!product) {
    notFound();
  }

  const productColors = [...new Set(product.variants.map((v) => v.color))];

  let categories = await getAllCategories(productType);
  if (!categories.some((category) => category.id === product.categoryId)) {
    // The product's own category may be tagged for the other type (e.g. it
    // was assigned before the last switch) — keep it selectable so editing
    // never shows a blank/invalid category.
    const currentCategory = await getCategoryById(product.categoryId);
    if (currentCategory) {
      categories = [...categories, currentCategory].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }
  }

  const defaultValues: ProductInput = {
    name: product.name,
    description: product.description ?? "",
    basePrice: product.basePrice.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
    isFeatured: product.isFeatured,
    categoryId: product.categoryId,
    isActive: product.isActive,
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: v.price?.toNumber() ?? null,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>

      <div>
        <h2 className="mb-2 text-sm font-medium">{t("images")}</h2>
        <ProductImageManager
          productId={product.id}
          images={product.images}
          productColors={productColors}
        />
      </div>

      <ProductForm
        categories={categories}
        defaultValues={defaultValues}
        productId={product.id}
        productType={productType}
      />
    </div>
  );
}
