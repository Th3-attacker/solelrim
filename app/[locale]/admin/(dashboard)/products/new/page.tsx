import { getTranslations } from "next-intl/server";
import { getAllCategories } from "@/lib/queries/products";
import { getStoreSettings } from "@/lib/queries/settings";
import { ProductForm } from "@/components/products/product-form";
import { isProductType, DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";

export default async function NewProductPage() {
  const [t, categories, settings] = await Promise.all([
    getTranslations("products"),
    getAllCategories(),
    getStoreSettings(),
  ]);
  const productType = isProductType(settings.productType)
    ? settings.productType
    : DEFAULT_PRODUCT_TYPE;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newProduct")}</h1>
      <ProductForm categories={categories} productType={productType} />
    </div>
  );
}
