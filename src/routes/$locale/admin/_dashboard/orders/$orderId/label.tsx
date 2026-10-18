import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFormatter, useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { OrderDetailSkeleton } from "@/components/dashboard/page-skeletons";
import { pageInput } from "@/src/server/validators";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/queries/orders";
import { getAdminScope } from "@/lib/auth/scope";
import { PrintLabelButton } from "@/components/orders/print-label-button";
import { PrintPageStyle } from "@/components/ui/print-page-style";
import { formatPrice } from "@/lib/format/currency";

// Ex-app/[locale]/admin/(dashboard)/orders/[orderId]/label/page.tsx.

const loadOrderLabelPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const { orderId } = data.params;
    const scope = await getAdminScope();
    const order = await getOrderById(orderId, scope);

    if (!order) {
      notFound();
    }

    return { order };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/orders/$orderId/label")({
  loader: ({ params }) => loadOrderLabelPage({ data: { params } }),
  component: OrderLabelPage,
  ...adminPageBoundaries,
  pendingComponent: OrderDetailSkeleton,
});

function OrderLabelPage() {
  const { order } = Route.useLoaderData();
  const t = useTranslations("orders");
  const tSales = useTranslations("sales");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* A real label printer feeds a fixed 10x15cm sheet. */}
      <PrintPageStyle rule="@page { size: 10cm 15cm; margin: 5mm; }" />
      <PrintLabelButton />

      <div className="flex w-[10cm] flex-col gap-2 border p-3 text-[11px] leading-tight print:w-full print:border-0 print:p-0">
        <div className="flex items-center justify-between border-b pb-1">
          <span className="text-sm font-bold">SOLAL</span>
          <span className="font-mono text-[10px]">{order.reference}</span>
        </div>

        {order.confirmedAt && (
          <p className="text-[9px] text-muted-foreground">
            {t("labelConfirmedOn")} {format.dateTime(order.confirmedAt, { dateStyle: "medium" })}
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
          <span>{formatPrice(order.total, tCommon("currency"))}</span>
        </div>

        <p className="text-[9px] text-muted-foreground">{t("labelReminder")}</p>
      </div>
    </div>
  );
}
