import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Tag } from "lucide-react";
import { getOrderById } from "@/lib/queries/orders";
import { getSignedPaymentProofUrl } from "@/lib/supabase/storage";
import { getAdminScope } from "@/lib/shop/admin-scope";
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
  const [t, tProducts, tSales, tCommon, order] = await Promise.all([
    getTranslations("orders"),
    getTranslations("products"),
    getTranslations("sales"),
    getTranslations("common"),
    getOrderById(orderId, scope),
  ]);

  if (!order) {
    notFound();
  }

  const signedUrl = await getSignedPaymentProofUrl(order.paymentProofPath);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.reference}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        {order.status === "PENDING" && <OrderActions orderId={order.id} />}
        {order.status === "CONFIRMED" && (
          <div className="flex items-center gap-3">
            {order.confirmedAt && (
              <p className="text-sm text-muted-foreground">
                {order.confirmedAt.toLocaleString()}
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
          <div className="flex items-center gap-3">
            {order.shippedAt && (
              <p className="text-sm text-muted-foreground">
                {order.shippedAt.toLocaleString()}
              </p>
            )}
            <OrderProgressActions orderId={order.id} status="SHIPPING" />
          </div>
        )}
        {order.status === "DELIVERED" && order.deliveredAt && (
          <p className="text-sm text-muted-foreground">
            {order.deliveredAt.toLocaleString()}
          </p>
        )}
        {order.status === "REJECTED" && (
          <div className="flex items-center gap-3">
            <div className="text-end">
              {order.rejectedAt && (
                <p className="text-sm text-muted-foreground">
                  {order.rejectedAt.toLocaleString()}
                </p>
              )}
              {order.rejectReason && (
                <p className="text-sm text-muted-foreground">
                  {t("cancelReasonLabel")}: {order.rejectReason}
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
                {order.cancelledAt.toLocaleString()}
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
