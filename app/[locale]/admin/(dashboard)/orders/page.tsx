import { getTranslations, getFormatter } from "next-intl/server";
import Image from "next/image";
import { ClipboardList } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAllOrders } from "@/lib/queries/orders";
import { parseOrderDateFilters } from "@/lib/orders/filters";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { ORDER_STATUS_LABEL_KEY } from "@/lib/shop/order-status";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderFilters } from "@/components/orders/order-filters";
import { StateMessage } from "@/components/ui/state-message";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ORDER_STATUSES: readonly string[] = Object.values(OrderStatus);

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : undefined;
  const status = rawStatus && ORDER_STATUSES.includes(rawStatus)
    ? (rawStatus as OrderStatus)
    : undefined;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const { dateFrom, dateTo } = parseOrderDateFilters({
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
  });
  const hasFilters = Boolean(status || search || dateFrom || dateTo);

  const scope = await getAdminScope();
  const [t, tCommon, format, orders] = await Promise.all([
    getTranslations("orders"),
    getTranslations("common"),
    getFormatter(),
    getAllOrders({ productType: scope, status, search, dateFrom, dateTo }),
  ]);

  const csvColumns = [
    { key: "reference", label: t("reference") },
    { key: "customer", label: t("customer") },
    { key: "phone", label: t("phone") },
    { key: "city", label: t("city") },
    { key: "total", label: t("total") },
    { key: "status", label: t("status") },
    { key: "date", label: t("date") },
  ];
  const csvRows = orders.map((order) => ({
    reference: order.reference,
    customer: order.customerName,
    phone: order.customerPhone,
    city: order.customerCity,
    total: formatPrice(order.total, tCommon("currency")),
    status: t(ORDER_STATUS_LABEL_KEY[order.status]),
    date: format.dateTime(order.createdAt, { dateStyle: "medium" }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <ExportCsvButton
          label={tCommon("exportCsv")}
          filename={`orders-${new Date().toISOString().slice(0, 10)}.csv`}
          columns={csvColumns}
          rows={csvRows}
        />
      </div>

      <OrderFilters />

      {orders.length === 0 ? (
        <StateMessage
          icon={ClipboardList}
          title={hasFilters ? tCommon("noResults") : t("noOrders")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>{t("reference")}</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const image = order.items[0]?.variant.product.images[0];
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                      {image ? (
                        <Image
                          src={getProductImageUrl(image.storagePath)}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.reference}
                    </Link>
                  </TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.customerPhone}
                  </TableCell>
                  <TableCell>{formatPrice(order.total, tCommon("currency"))}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format.dateTime(order.createdAt, { dateStyle: "medium" })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
