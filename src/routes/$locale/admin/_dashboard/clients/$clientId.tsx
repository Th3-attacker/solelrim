import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFormatter, useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ClientDetailSkeleton } from "@/components/dashboard/page-skeletons";
import { pageInput } from "@/src/server/validators";
import { notFound } from "next/navigation";
import { Gift, IdentificationCard } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import {
  getClientById,
  getClientSalesPage,
  getClientSalesStats,
  CLIENT_SALES_PAGE_SIZE,
} from "@/lib/queries/clients";
import { getOrdersByPhonePage, CLIENT_ORDERS_PAGE_SIZE } from "@/lib/queries/orders";
import { getAdminScope } from "@/lib/auth/scope";
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

// Ex-app/[locale]/admin/(dashboard)/clients/[clientId]/page.tsx.

const loadClientDetailPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const { clientId } = data.params;
    const { salesPage: salesPageParam, ordersPage: ordersPageParam } = data.search;
    const salesPage = Number(salesPageParam) || 1;
    const ordersPage = Number(ordersPageParam) || 1;
    const scope = await getAdminScope();
    const client = await getClientById(clientId, scope);

    if (!client) {
      notFound();
    }

    // Only ever looked up once we know the client (need their id/phone), so
    // these can't run in the same Promise.all above.
    const [{ sales, total: salesTotal }, ordersResult, stats] = await Promise.all([
      getClientSalesPage(clientId, scope, salesPage),
      client.phone
        ? getOrdersByPhonePage(client.phone, scope, ordersPage)
        : Promise.resolve({ orders: [], total: 0, page: 1 }),
      getClientSalesStats(clientId, scope),
    ]);
    const onlineOrders = ordersResult.orders;
    const ordersTotal = ordersResult.total;

    // Les tailles de page viennent du serveur : leurs modules (lib/queries)
    // importent Prisma et n'ont rien à faire dans le navigateur.
    return {
      clientId,
      salesPageParam,
      ordersPageParam,
      salesPage,
      ordersPage,
      client,
      sales,
      salesTotal,
      stats,
      onlineOrders,
      ordersTotal,
      clientSalesPageSize: CLIENT_SALES_PAGE_SIZE,
      clientOrdersPageSize: CLIENT_ORDERS_PAGE_SIZE,
    };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/clients/$clientId")({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ params, deps }) => loadClientDetailPage({ data: { params, search: deps.search } }),
  component: ClientDetailPage,
  ...adminPageBoundaries,
  pendingComponent: ClientDetailSkeleton,
});

function ClientDetailPage() {
  const {
    clientId,
    salesPageParam,
    ordersPageParam,
    salesPage,
    ordersPage,
    client,
    sales,
    salesTotal,
    stats,
    onlineOrders,
    ordersTotal,
    clientSalesPageSize,
    clientOrdersPageSize,
  } = Route.useLoaderData();
  const t = useTranslations("clients");
  const tSales = useTranslations("sales");
  const tOrders = useTranslations("orders");
  const tCommon = useTranslations("common");
  const tPromo = useTranslations("promoCodes");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{client.fullName}</h1>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {client.loyaltyEnrolledAt ? (
          <div className="col-span-2 flex items-start gap-2 rounded-md border bg-card p-3">
            <IdentificationCard aria-hidden="true" className="mt-0.5 size-5 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tabular-nums">
                {t("loyaltyPoints", { points: client.loyaltyPoints })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("loyaltySince", {
                  date: format.dateTime(client.loyaltyEnrolledAt, { dateStyle: "medium" }),
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="col-span-2 flex items-center rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {t("loyaltyNotEnrolled")}
          </div>
        )}
        <div className="flex flex-col rounded-md border bg-card p-3">
          <span className="text-lg font-semibold tabular-nums">{stats.purchaseCount}</span>
          <span className="text-xs text-muted-foreground">{t("purchaseCount")}</span>
        </div>
        <div className="flex flex-col rounded-md border bg-card p-3">
          <span className="text-lg font-semibold tabular-nums">
            {formatPrice(stats.totalSpent, tCommon("currency"))}
          </span>
          <span className="text-xs text-muted-foreground">{t("totalSpent")}</span>
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
                  <TableHead>{t("pointsColumn")}</TableHead>
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
                    <TableCell
                      dir="ltr"
                      className={
                        sale.status === "CANCELLED"
                          ? "tabular-nums text-muted-foreground line-through"
                          : "tabular-nums"
                      }
                    >
                      {[
                        sale.loyaltyPointsEarned > 0 && `+${sale.loyaltyPointsEarned}`,
                        sale.loyaltyPointsRedeemed > 0 && `-${sale.loyaltyPointsRedeemed}`,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              page={salesPage}
              pageSize={clientSalesPageSize}
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
              pageSize={clientOrdersPageSize}
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
