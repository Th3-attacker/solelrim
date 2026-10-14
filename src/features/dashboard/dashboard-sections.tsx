import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import { formatPriceNumber } from "@/lib/format/currency";
import { cn } from "~/lib/cn";
import { Card } from "~/components/ui/card";
import { Segmented } from "~/components/ui/field";
import { Icon, type IconName } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { ORDER_STATUS } from "~/features/orders/order-status";
import { shellQuery } from "~/features/shell/shell.queries";
import type { getDashboard, getRevenue } from "./dashboard.functions";
import type { RevenuePeriod } from "./revenue";
import { RevenueChart } from "./revenue-chart";

// The dashboard's sections, top to bottom as in the design.

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
type Summary = DashboardData["summary"];

export function Welcome({
  now,
  summary,
  pendingCount,
}: {
  now: Date;
  summary: Summary;
  pendingCount: number;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const { data: shell } = useSuspenseQuery(shellQuery);
  const name = shell.admin.name?.split(/\s+/)[0];
  const ratio =
    summary.revenueLastMonth > 0 ? summary.revenueThisMonth / summary.revenueLastMonth : null;

  return (
    <section
      aria-labelledby="dashboard-title"
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="text-[13px] text-muted first-letter:uppercase">
          <time dateTime={now.toISOString()}>
            {format.dateTime(now, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
        <h1 id="dashboard-title" className="mt-0.5 text-page-title">
          {name ? t("greetingWithName", { name }) : t("greeting")}
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-2">
          {ratio !== null && ratio >= 1.1 && (
            <>
              {t("monthRevenueMultiple", {
                ratio: format.number(ratio, { maximumFractionDigits: 1 }),
              })}{" "}
            </>
          )}
          {t("paymentsToCheckSentence", { count: pendingCount })}
        </p>
      </div>
    </section>
  );
}

export function ToHandle({ data }: { data: DashboardData }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const cards: Array<{
    key: string;
    icon: IconName;
    tone: string;
    title: string;
    detail?: string;
  }> = [];

  if (data.pending.count > 0) {
    cards.push({
      key: "orders",
      icon: "clock",
      tone: "bg-pend-bg text-pend-ink",
      title: t("pendingOrdersCard", { count: data.pending.count }),
      detail: data.pending.oldestAt
        ? t("oldestPendingAge", { age: format.relativeTime(data.pending.oldestAt, data.now) })
        : undefined,
    });
  }
  if (data.lowStock.length > 0) {
    cards.push({
      key: "stock",
      icon: "alert",
      tone: "bg-warn-bg text-warn-ink",
      title: t("lowStockVariantsCard", { count: data.lowStock.length }),
      detail: data.lowStock
        .slice(0, 2)
        .map((variant) => `${variant.productName} ${variant.size} ${variant.color}`)
        .join(", "),
    });
  }
  if (data.refunds.count > 0) {
    cards.push({
      key: "refunds",
      icon: "sales",
      tone: "bg-tint text-brand",
      title: t("pendingRefundsCard", { count: data.refunds.count }),
      detail: data.refunds.latestAt
        ? t("latestRefundRequested", { age: format.relativeTime(data.refunds.latestAt, data.now) })
        : undefined,
    });
  }

  return (
    <section aria-label={t("toHandleLabel")}>
      {cards.length === 0 ? (
        <Card className="flex items-center gap-3 p-4 text-[14px] text-ink-2">
          <Icon name="check" className="text-ok-ink" />
          {t("nothingToHandle")}
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-3">
          {cards.map((card) => (
            <li key={card.key}>
              <Card className="flex h-full items-center gap-3.5 p-4">
                <span
                  className={cn(
                    "inline-flex size-10 flex-none items-center justify-center rounded-control",
                    card.tone,
                  )}
                >
                  <Icon name={card.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[14px]">{card.title}</b>
                  {card.detail && (
                    <span className="block truncate text-[13px] text-muted">{card.detail}</span>
                  )}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function KeyFigures({
  summary,
  lowStockCount,
}: {
  summary: Summary;
  lowStockCount: number;
}) {
  const t = useTranslations("dashboard");
  const currency = useTranslations("common")("currency");
  const format = useFormatter();
  const percent = (current: number, previous: number) =>
    previous > 0 ? (current - previous) / previous : null;
  const revenueTrend = percent(summary.revenueThisMonth, summary.revenueLastMonth);
  const salesTrend = percent(summary.salesThisMonth, summary.salesLastMonth);

  const trend = (value: number | null) =>
    value === null ? null : (
      <>
        <span className={cn("font-semibold", value >= 0 ? "text-ok-ink" : "text-bad-ink")}>
          <span aria-hidden="true">{value >= 0 ? "↑ " : "↓ "}</span>
          {format.number(Math.abs(value), { style: "percent", maximumFractionDigits: 1 })}
        </span>{" "}
        {t("versusLastMonth")}
      </>
    );

  const tiles: Array<{ label: string; value: ReactNode; detail: ReactNode }> = [
    {
      label: t("revenueThisMonthTile"),
      value: <Amount value={summary.revenueThisMonth} currency={currency} />,
      detail: trend(revenueTrend),
    },
    {
      label: t("salesThisMonthTile"),
      value: format.number(summary.salesThisMonth),
      detail: trend(salesTrend),
    },
    {
      label: t("revenueAllTime"),
      value: <Amount value={summary.revenueAllTime} currency={currency} />,
      detail: t("salesSinceOpening", { count: summary.salesAllTime }),
    },
    {
      label: t("activeClients"),
      value: format.number(summary.activeClients),
      detail: t("newClientsThisMonthShort", { count: summary.newClientsThisMonth }),
    },
    {
      label: t("unitsInStock"),
      value: format.number(summary.unitsInStock),
      detail:
        lowStockCount > 0 ? (
          <Status tone="warn">{t("lowStockStatus", { count: lowStockCount })}</Status>
        ) : null,
    },
  ];

  return (
    <Card as="section" aria-label={t("keyFiguresLabel")}>
      <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 border-line-soft p-5 not-last:border-b xl:border-b-0 xl:not-last:border-e"
          >
            <dt className="text-[13px] text-muted">{tile.label}</dt>
            <dd className="text-page-title text-brand tabular-nums">{tile.value}</dd>
            {tile.detail && <dd className="text-[12px] text-muted">{tile.detail}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Amount({ value, currency }: { value: number; currency: string }) {
  return (
    <>
      {formatPriceNumber(value)}{" "}
      <small className="text-[14px] font-normal text-muted">{currency}</small>
    </>
  );
}

export function RevenueCard({
  period,
  data,
  onPeriodChange,
}: {
  period: RevenuePeriod;
  data: Awaited<ReturnType<typeof getRevenue>>;
  onPeriodChange: (period: RevenuePeriod) => void;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const currency = useTranslations("common")("currency");

  const bestLabel = data.best
    ? format.dateTime(new Date(`${data.best.start}T00:00:00Z`), {
        day: data.unit === "month" ? undefined : "numeric",
        month: "long",
        year: data.unit === "month" ? "numeric" : undefined,
      })
    : null;

  return (
    <Card as="section" aria-labelledby="revenue-title" className="p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="revenue-title" className="text-card-title">
            {t("revenue")}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {t("revenueChartSubtitle", { unit: data.unit })}
            {data.best && bestLabel && (
              <>
                {" · "}
                {t("revenueBestBucket", {
                  unit: data.unit,
                  label: bestLabel,
                  amount: `${formatPriceNumber(data.best.total)} ${currency}`,
                })}
              </>
            )}
          </p>
        </div>
        <Segmented
          label={t("revenuePeriodLabel")}
          name="revenue-period"
          value={period}
          onChange={onPeriodChange}
          options={[
            { value: "all", label: t("allTime") },
            { value: "3m", label: t("last90Days") },
            { value: "30d", label: t("last30Days") },
            { value: "7d", label: t("last7Days") },
          ]}
        />
      </div>
      {data.buckets.every((bucket) => bucket.total === 0) ? (
        <p className="py-10 text-center text-[14px] text-muted">{t("noRevenueYet")}</p>
      ) : (
        <RevenueChart
          buckets={data.buckets}
          unit={data.unit}
          bestStart={data.best?.start ?? null}
        />
      )}
    </Card>
  );
}

type BestSeller = DashboardData["bestSellers"][number];

export function BestSellers({ items }: { items: BestSeller[] }) {
  const t = useTranslations("dashboard");
  const top = Math.max(...items.map((item) => item.quantity), 1);
  return (
    <Card as="section" aria-labelledby="best-sellers-title" className="p-5">
      <h2 id="best-sellers-title" className="text-card-title">
        {t("bestSellers")}
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">{t("bestSellersSubtitle")}</p>
      {items.length === 0 ? (
        <p className="py-6 text-[14px] text-muted">{t("noBestSellers")}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3.5">
          {items.map((item, index) => (
            <li key={item.variantId}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{item.productName}</b>{" "}
                  <span className="text-muted">
                    · {item.size} · {item.color}
                  </span>
                </span>
                <b className="tabular-nums">{item.quantity}</b>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-tile">
                <div
                  className={cn("h-full rounded-full", index === 0 ? "bg-brand" : "bg-brand-2")}
                  style={{ width: `${(item.quantity / top) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

type LowStockItem = DashboardData["lowStock"][number];

export function LowStock({ items }: { items: LowStockItem[] }) {
  const t = useTranslations("dashboard");
  return (
    <Card as="section" aria-labelledby="low-stock-title" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="low-stock-title" className="text-card-title">
          {t("lowStock")}
        </h2>
        {items.length > 0 && (
          <Status tone="warn">{t("lowStockVariantsBadge", { count: items.length })}</Status>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-muted">{t("lowStockSubtitle")}</p>
      {items.length === 0 ? (
        <p className="py-6 text-[14px] text-muted">{t("noLowStock")}</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px] font-semibold">{item.productName}</b>
                <span className="text-[12px] text-muted">
                  {item.size} · {item.color}
                </span>
              </span>
              <b
                className={cn(
                  "text-[13px] tabular-nums",
                  item.stock === 0 ? "text-bad-ink" : "text-warn-ink",
                )}
              >
                {t("onlyLeft", { count: item.stock })}
              </b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type LatestOrder = DashboardData["latestOrders"][number];

export function LatestOrders({ orders, now }: { orders: LatestOrder[]; now: Date }) {
  const t = useTranslations("dashboard");
  const tOrders = useTranslations("orders");
  const currency = useTranslations("common")("currency");
  const format = useFormatter();
  const cell = "border-b border-line-soft px-4 py-3 text-start whitespace-nowrap";
  const head =
    "border-b border-line-soft bg-surface-2 px-4 py-2.5 text-start text-[12px] font-medium text-muted";

  return (
    <Card as="section" aria-labelledby="latest-orders-title" className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="latest-orders-title" className="text-card-title">
          {t("latestOrdersTitle")}
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">{t("latestOrdersSubtitle")}</p>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 pb-6 text-[14px] text-muted">{tOrders("noOrders")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px] tabular-nums">
            <caption className="sr-only">{t("latestOrdersTitle")}</caption>
            <thead>
              <tr>
                <th scope="col" className={head}>
                  {tOrders("reference")}
                </th>
                <th scope="col" className={head}>
                  {tOrders("customer")}
                </th>
                <th scope="col" className={cn(head, "text-end")}>
                  {tOrders("total")}
                </th>
                <th scope="col" className={head}>
                  {tOrders("status")}
                </th>
                <th scope="col" className={head}>
                  {t("receivedColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = ORDER_STATUS[order.status];
                return (
                  <tr key={order.id} className="hover:bg-surface-2 [&:last-child>*]:border-b-0">
                    <th scope="row" className={cn(cell, "font-semibold")}>
                      {order.reference}
                    </th>
                    <td className={cell}>{order.customerName}</td>
                    <td className={cn(cell, "text-end font-semibold")}>
                      {formatPriceNumber(order.total)} {currency}
                    </td>
                    <td className={cell}>
                      <Status tone={status.tone}>{tOrders(status.label)}</Status>
                    </td>
                    <td className={cn(cell, "text-muted")}>
                      <time dateTime={order.createdAt.toISOString()}>
                        {format.relativeTime(order.createdAt, now)}
                      </time>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
