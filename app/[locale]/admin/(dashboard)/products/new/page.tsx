import { getTranslations } from "next-intl/server";
import { getAllCategories } from "@/lib/queries/products";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const [t, categories] = await Promise.all([
    getTranslations("products"),
    getAllCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newProduct")}</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
