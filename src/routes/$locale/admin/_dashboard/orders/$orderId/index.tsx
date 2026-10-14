import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ButtonLink } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { ORDER_STATUS } from "~/features/orders/order-status";
import { orderQuery } from "~/features/orders/orders.queries";
import {
  MobileOrderActions,
  OrderCustomer,
  OrderItems,
  OrderTracking,
  PaymentProof,
} from "~/features/orders/order-detail";

export const Route = createFileRoute("/$locale/admin/_dashboard/orders/$orderId/")({
  loader: async ({ context: { queryClient }, params }) => {
    const order = await queryClient.ensureQueryData(orderQuery(params.orderId));
    if (!order) throw notFound();
    return { reference: order.reference };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.reference} · SOLAL Admin` }] : [],
  }),
  staticData: { section: "admin.nav.salesGroup", title: "nav.orders" },
  component: OrderPage,
});

function OrderPage() {
  const t = useTranslations("orders");
  const format = useFormatter();
  const { locale } = Route.useRouteContext();
  const { orderId } = Route.useParams();
  const { data } = useSuspenseQuery(orderQuery(orderId));
  // The loader made sure it exists; the live channel may still find it gone.
  if (!data) return null;
  const order = data;
  const status = ORDER_STATUS[order.status];
  const stale =
    order.status === "PENDING" &&
    order.now.getTime() - order.createdAt.getTime() >= order.staleAfterHours * 3_600_000;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-44 md:px-8 lg:pb-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/$locale/admin/orders"
            params={{ locale }}
            className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
          >
            <Icon name="chevronLeft" className="size-4" />
            {t("backToOrders")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 dir="ltr" className="text-page-title">
              {order.reference}
            </h1>
            <Status tone={status.tone}>{t(status.label)}</Status>
          </div>
          <p className="mt-1 text-[14px] text-muted">
            {t("receivedOn", {
              date: format.dateTime(order.createdAt, { dateStyle: "long", timeStyle: "short" }),
            })}
            {stale && (
              <b className="ms-2 text-warn-ink">
                · {t("staleWarning", { hours: order.staleAfterHours })}
              </b>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.whatsappLink && (
            <a
              href={order.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 text-[14px] font-semibold text-ink no-underline hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="chat" />
              {t("whatsappCustomer")}
            </a>
          )}
          <a
            href={`tel:+222${order.customer.phone}`}
            className="inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 text-[14px] font-semibold text-ink no-underline hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="phone" />
            {t("callCustomer")}
          </a>
          {order.status !== "REJECTED" && order.status !== "PENDING" && (
            <ButtonLink to="/$locale/admin/orders/$orderId/label" params={{ locale, orderId }}>
              <Icon name="print" />
              {t("printLabel")}
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <PaymentProof
            order={order}
            linkToOrder={(id, reference) => (
              <Link
                to="/$locale/admin/orders/$orderId"
                params={{ locale, orderId: id }}
                className="font-semibold"
              >
                {reference}
              </Link>
            )}
          />
          <OrderItems order={order} />
        </div>
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          <OrderTracking order={order} />
          <OrderCustomer order={order} />
        </aside>
      </div>
      <MobileOrderActions order={order} />
    </div>
  );
}
