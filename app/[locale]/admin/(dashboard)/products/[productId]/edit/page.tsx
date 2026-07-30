import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProductById, getAllCategories } from "@/lib/queries/products";
import { getStoreSettings } from "@/lib/queries/settings";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageManager } from "@/components/products/product-image-manager";
import type { ProductInput } from "@/lib/validation/product";
import { isProductType, DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const [t, product, categories, settings] = await Promise.all([
    getTranslations("products"),
    getProductById(productId),
    getAllCategories(),
    getStoreSettings(),
  ]);

  if (!product) {
    notFound();
  }

  const productType = isProductType(settings.productType)
    ? settings.productType
    : DEFAULT_PRODUCT_TYPE;

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
        <ProductImageManager productId={product.id} images={product.images} />
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
