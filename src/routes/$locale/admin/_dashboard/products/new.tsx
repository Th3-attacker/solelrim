import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ProductsSkeleton } from "@/components/dashboard/page-skeletons";
import { getAllCategories } from "@/lib/queries/products";
import { getAdminScope } from "@/lib/auth/scope";
import { ProductForm } from "@/components/products/product-form";

// Ex-app/[locale]/admin/(dashboard)/products/new/page.tsx.

const loadNewProductPage = createServerFn({ method: "GET" }).handler(async () => {
  const productType = await getAdminScope();
  const categories = await getAllCategories(productType);

  return { productType, categories };
});

export const Route = createFileRoute("/$locale/admin/_dashboard/products/new")({
  loader: () => loadNewProductPage(),
  component: NewProductPage,
  ...adminPageBoundaries,
  pendingComponent: ProductsSkeleton,
});

function NewProductPage() {
  const { productType, categories } = Route.useLoaderData();
  const t = useTranslations("products");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newProduct")}</h1>
      <ProductForm categories={categories} productType={productType} />
    </div>
  );
}
