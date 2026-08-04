import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ClipboardList } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAllOrders } from "@/lib/queries/orders";
import { parseOrderDateFilters } from "@/lib/orders/filters";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderFilters } from "@/components/orders/order-filters";
import { StateMessage } from "@/components/ui/state-message";
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
  const [t, tCommon, orders] = await Promise.all([
    getTranslations("orders"),
    getTranslations("common"),
    getAllOrders({ productType: scope, status, search, dateFrom, dateTo }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

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
                    {order.createdAt.toLocaleDateString()}
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
