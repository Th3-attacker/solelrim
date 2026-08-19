import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { Gift } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { getClientById, getClientSalesPage, CLIENT_SALES_PAGE_SIZE } from "@/lib/queries/clients";
import { getOrdersByPhonePage, CLIENT_ORDERS_PAGE_SIZE } from "@/lib/queries/orders";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { ClientForm } from "@/components/clients/client-form";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { PromoCodeFormDialog } from "@/components/settings/promo-code-form-dialog";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
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

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ salesPage?: string; ordersPage?: string }>;
}) {
  const { clientId } = await params;
  const { salesPage: salesPageParam, ordersPage: ordersPageParam } = await searchParams;
  const salesPage = Number(salesPageParam) || 1;
  const ordersPage = Number(ordersPageParam) || 1;
  const scope = await getAdminScope();
  const [t, tSales, tOrders, tCommon, tPromo, format, client] = await Promise.all([
    getTranslations("clients"),
    getTranslations("sales"),
    getTranslations("orders"),
    getTranslations("common"),
    getTranslations("promoCodes"),
    getFormatter(),
    getClientById(clientId, scope),
  ]);

  if (!client) {
    notFound();
  }

  // Only ever looked up once we know the client (need their id/phone), so
  // these can't run in the same Promise.all above.
  const [{ sales, total: salesTotal }, ordersResult] = await Promise.all([
    getClientSalesPage(clientId, scope, salesPage),
    client.phone
      ? getOrdersByPhonePage(client.phone, scope, ordersPage)
      : Promise.resolve({ orders: [], total: 0, page: 1 }),
  ]);
  const onlineOrders = ordersResult.orders;
  const ordersTotal = ordersResult.total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.fullName}
        </h1>
        <div className="flex items-center gap-2">
          <PromoCodeFormDialog
            fixedClient={{ id: client.id, fullName: client.fullName }}
            trigger={
              <Button type="button" variant="outline">
                <Gift className="size-4" />
                {tPromo("giveCode")}
              </Button>
            }
          />
          <DeleteClientButton clientId={client.id} />
        </div>
      </div>

      <ClientForm
        clientId={client.id}
        defaultValues={{
          fullName: client.fullName,
          phone: client.phone ?? "",
          email: client.email ?? "",
          address: client.address ?? "",
          notes: client.notes ?? "",
        }}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("purchaseHistory")}</h2>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tSales("noSales")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tSales("reference")}</TableHead>
                  <TableHead>{tSales("date")}</TableHead>
                  <TableHead>{tSales("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <Link
                        href={`/admin/sales/${sale.id}`}
                        className="font-medium hover:underline"
                      >
                        {sale.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(sale.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell>{formatPrice(sale.total, tCommon("currency"))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              page={salesPage}
              pageSize={CLIENT_SALES_PAGE_SIZE}
              total={salesTotal}
              basePath={`/admin/clients/${clientId}`}
              searchParams={{ ordersPage: ordersPageParam }}
              paramName="salesPage"
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("onlineOrders")}</h2>
        {!client.phone ? (
          <p className="text-sm text-muted-foreground">{t("onlineOrdersNoPhone")}</p>
        ) : onlineOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tOrders("noOrders")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tOrders("reference")}</TableHead>
                  <TableHead>{tOrders("date")}</TableHead>
                  <TableHead>{tOrders("total")}</TableHead>
                  <TableHead>{tOrders("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onlineOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(order.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell>{formatPrice(order.total, tCommon("currency"))}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              page={ordersPage}
              pageSize={CLIENT_ORDERS_PAGE_SIZE}
              total={ordersTotal}
              basePath={`/admin/clients/${clientId}`}
              searchParams={{ salesPage: salesPageParam }}
              paramName="ordersPage"
            />
          </>
        )}
      </div>
    </div>
  );
}
