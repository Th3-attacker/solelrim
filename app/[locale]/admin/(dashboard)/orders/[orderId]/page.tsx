import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { differenceInHours } from "date-fns";
import { Tag } from "@phosphor-icons/react/dist/ssr";
import { getOrderById } from "@/lib/queries/orders";
import { getSignedPaymentProofUrl } from "@/lib/supabase/storage";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { REASON_LABEL_KEY } from "@/lib/shop/client-messages";
import { STALE_PENDING_HOURS } from "@/lib/shop/order-status";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderProgressActions } from "@/components/orders/order-progress-actions";
import { ClientMessageButton } from "@/components/orders/client-message-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const scope = await getAdminScope();
  const [t, tProducts, tSales, tCommon, format, order] = await Promise.all([
    getTranslations("orders"),
    getTranslations("products"),
    getTranslations("sales"),
    getTranslations("common"),
    getFormatter(),
    getOrderById(orderId, scope),
  ]);

  if (!order) {
    notFound();
  }

  const signedUrl = await getSignedPaymentProofUrl(order.paymentProofPath);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.reference}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        {order.status === "PENDING" && (
          <div className="flex flex-wrap items-center gap-3">
            {differenceInHours(new Date(), order.createdAt) >= STALE_PENDING_HOURS && (
              <p className="text-sm text-warning">
                {t("pendingSince", {
                  time: format.relativeTime(order.createdAt, new Date()),
                })}
              </p>
            )}
            <OrderActions orderId={order.id} />
          </div>
        )}
        {order.status === "CONFIRMED" && (
          <div className="flex flex-wrap items-center gap-3">
            {order.confirmedAt && (
              <p className="text-sm text-muted-foreground">
                {format.dateTime(order.confirmedAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/orders/${order.id}/label`}>
                <Tag className="size-4" />
                {t("printLabel")}
              </Link>
            </Button>
            <ClientMessageButton
              type="confirmation"
              locale={order.locale}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              reference={order.reference}
              total={order.total.toNumber()}
            />
            <OrderProgressActions orderId={order.id} status="CONFIRMED" />
          </div>
        )}
        {order.status === "SHIPPING" && (
          <div className="flex flex-wrap items-center gap-3">
            {order.shippedAt && (
              <p className="text-sm text-muted-foreground">
                {format.dateTime(order.shippedAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            <ClientMessageButton
              type="shipped"
              locale={order.locale}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              reference={order.reference}
            />
            <OrderProgressActions orderId={order.id} status="SHIPPING" />
          </div>
        )}
        {order.status === "DELIVERED" && (
          <div className="flex flex-wrap items-center gap-3">
            {order.deliveredAt && (
              <p className="text-sm text-muted-foreground">
                {format.dateTime(order.deliveredAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            <ClientMessageButton
              type="delivered"
              locale={order.locale}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              reference={order.reference}
            />
          </div>
        )}
        {order.status === "REJECTED" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-end">
              {order.rejectedAt && (
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(order.rejectedAt, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              {order.rejectReason && (
                <p className="text-sm text-muted-foreground">
                  {t("cancelReasonLabel")}:{" "}
                  {REASON_LABEL_KEY[order.rejectReason]
                    ? t(REASON_LABEL_KEY[order.rejectReason])
                    : order.rejectReason}
                </p>
              )}
            </div>
            {order.rejectReason && (
              <ClientMessageButton
                type="rejection"
                locale={order.locale}
                customerName={order.customerName}
                customerPhone={order.customerPhone}
                reference={order.reference}
                reason={order.rejectReason}
              />
            )}
          </div>
        )}
        {order.status === "CANCELLED" && (
          <div className="text-end">
            {order.cancelledAt && (
              <p className="text-sm text-muted-foreground">
                {format.dateTime(order.cancelledAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            {order.cancelReason && (
              <p className="text-sm text-muted-foreground">
                {t("cancelReasonLabel")}: {order.cancelReason}
              </p>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-2 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("customer")}</p>
            <p className="text-sm font-medium">{order.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("phone")}</p>
            <p className="text-sm font-medium">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("city")}</p>
            <p className="text-sm font-medium">{order.customerCity}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium">{t("itemsTitle")}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tProducts("name")}</TableHead>
              <TableHead>{tProducts("size")}</TableHead>
              <TableHead>{tProducts("color")}</TableHead>
              <TableHead>{tSales("quantity")}</TableHead>
              <TableHead>{tSales("unitPrice")}</TableHead>
              <TableHead>{tSales("lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.variant.product.name}</TableCell>
                <TableCell>{item.variant.size}</TableCell>
                <TableCell>{item.variant.color}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatPrice(item.unitPrice, tCommon("currency"))}</TableCell>
                <TableCell>{formatPrice(item.lineTotal, tCommon("currency"))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-2 flex justify-end text-sm font-medium">
          {tSales("total")}: {formatPrice(order.total, tCommon("currency"))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">{t("paymentProof")}</h2>
        {signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt={t("paymentProof")}
            className="max-w-sm rounded-lg border"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("paymentProof")}</p>
        )}
      </div>
    </div>
  );
}
