import { getTranslations } from "next-intl/server";
import { getAllCategories } from "@/lib/queries/products";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const [t, productType] = await Promise.all([
    getTranslations("products"),
    getAdminScope(),
  ]);
  const categories = await getAllCategories(productType);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newProduct")}</h1>
      <ProductForm categories={categories} productType={productType} />
    </div>
  );
}
