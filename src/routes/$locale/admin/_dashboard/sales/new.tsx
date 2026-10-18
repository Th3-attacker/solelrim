import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { SalesSkeleton } from "@/components/dashboard/page-skeletons";
import { getAllClients } from "@/lib/queries/clients";
import { getAllVariantsForSale } from "@/lib/queries/sales";
import { getAdminScope } from "@/lib/auth/scope";
import { SaleForm } from "@/components/sales/sale-form";

// Ex-app/[locale]/admin/(dashboard)/sales/new/page.tsx.

const loadNewSalePage = createServerFn({ method: "GET" }).handler(async () => {
  const scope = await getAdminScope();
  const [clients, variants] = await Promise.all([
    getAllClients(scope),
    getAllVariantsForSale(scope),
  ]);

  return { clients, variants };
});

export const Route = createFileRoute("/$locale/admin/_dashboard/sales/new")({
  loader: () => loadNewSalePage(),
  component: NewSalePage,
  ...adminPageBoundaries,
  pendingComponent: SalesSkeleton,
});

function NewSalePage() {
  const { clients, variants } = Route.useLoaderData();
  const t = useTranslations("sales");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newSale")}</h1>
      <SaleForm
        clients={clients.map((c) => ({ id: c.id, fullName: c.fullName }))}
        variants={variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: v.stock,
          price: (v.price ?? v.product.basePrice).toNumber(),
          productName: v.product.name,
        }))}
      />
    </div>
  );
}
