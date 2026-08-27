import { getTranslations, getFormatter } from "next-intl/server";
import Image from "next/image";
import { differenceInHours } from "date-fns";
import { ClipboardText, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { getAllOrders, getAllOrdersForExport, ORDERS_PAGE_SIZE } from "@/lib/queries/orders";
import { parseOrderDateFilters } from "@/lib/orders/filters";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { ORDER_STATUS_LABEL_KEY, STALE_PENDING_HOURS } from "@/lib/shop/order-status";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderFilters } from "@/components/orders/order-filters";
import { StateMessage } from "@/components/ui/state-message";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { ListPagination } from "@/components/ui/list-pagination";
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
  const rawFrom = typeof params.from === "string" ? params.from : undefined;
  const rawTo = typeof params.to === "string" ? params.to : undefined;
  const { dateFrom, dateTo } = parseOrderDateFilters({ from: rawFrom, to: rawTo });
  const hasFilters = Boolean(status || search || dateFrom || dateTo);
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const scope = await getAdminScope();
  const orderFilters = { productType: scope, status, search, dateFrom, dateTo };
  const [t, tCommon, format, { orders, total }, exportRows] = await Promise.all([
    getTranslations("orders"),
    getTranslations("common"),
    getFormatter(),
    getAllOrders(orderFilters, page),
    getAllOrdersForExport(orderFilters),
  ]);

  const csvColumns = [
    { key: "reference", label: t("reference") },
    { key: "customer", label: t("customer") },
    { key: "phone", label: t("phone") },
    { key: "city", label: t("city") },
    { key: "paymentSenderPhone", label: t("paymentSenderPhone") },
    { key: "total", label: t("total") },
    { key: "status", label: t("status") },
    { key: "date", label: t("date") },
  ];
  const csvRows = exportRows.map((order) => ({
    reference: order.reference,
    customer: order.customerName,
    phone: order.customerPhone,
    city: order.customerCity,
    paymentSenderPhone: order.paymentSenderPhone ?? "",
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
          icon={hasFilters ? MagnifyingGlass : ClipboardText}
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
              const isStale =
                order.status === "PENDING" &&
                differenceInHours(new Date(), order.createdAt) >= STALE_PENDING_HOURS;
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
                    {isStale && (
                      <p className="text-warning">
                        {t("pendingSince", {
                          time: format.relativeTime(order.createdAt, new Date()),
                        })}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ListPagination
        page={page}
        pageSize={ORDERS_PAGE_SIZE}
        total={total}
        basePath="/admin/orders"
        searchParams={{ status, q: search, from: rawFrom, to: rawTo }}
      />
    </div>
  );
}
