import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrderById } from "@/lib/queries/orders";
import { PrintLabelButton } from "@/components/orders/print-label-button";
import "./label.css";

export default async function OrderLabelPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [t, tSales, order] = await Promise.all([
    getTranslations("orders"),
    getTranslations("sales"),
    getOrderById(orderId),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PrintLabelButton />

      <div className="flex w-[10cm] flex-col gap-2 border p-3 text-[11px] leading-tight print:w-full print:border-0 print:p-0">
        <div className="flex items-center justify-between border-b pb-1">
          <span className="text-sm font-bold">Solelrim</span>
          <span className="font-mono text-[10px]">{order.reference}</span>
        </div>

        {order.confirmedAt && (
          <p className="text-[9px] text-muted-foreground">
            {t("labelConfirmedOn")} {order.confirmedAt.toLocaleDateString()}
          </p>
        )}

        <div>
          <p className="text-base font-semibold">{order.customerName}</p>
          <p>{order.customerPhone}</p>
          <p>{order.customerCity}</p>
        </div>

        <div className="flex flex-col gap-0.5 border-t border-dashed pt-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="truncate">
                {item.variant.product.name} ({item.variant.size}/{item.variant.color})
              </span>
              <span className="shrink-0">×{item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-1 font-semibold">
          <span>{tSales("total")}</span>
          <span>{order.total.toFixed(2)}</span>
        </div>

        <p className="text-[9px] text-muted-foreground">{t("labelReminder")}</p>
      </div>
    </div>
  );
}
