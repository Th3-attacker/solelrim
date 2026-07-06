import { getTranslations } from "next-intl/server";
import { getAllClients } from "@/lib/queries/clients";
import { getAllVariantsForSale } from "@/lib/queries/sales";
import { SaleForm } from "@/components/sales/sale-form";

export default async function NewSalePage() {
  const [t, clients, variants] = await Promise.all([
    getTranslations("sales"),
    getAllClients(),
    getAllVariantsForSale(),
  ]);

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
