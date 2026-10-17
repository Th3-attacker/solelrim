import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import type { z } from "zod";
import { SALE_STATUSES } from "@/lib/shop/my-sales-filters";
import { Button, ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Field, Input, Select } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { Pagination } from "~/components/table/data-table";
import type { Locale } from "~/i18n/config";
import { useMoney } from "~/features/pos/till-parts";
import { SALE_TONE, usePaymentLabel } from "./sale-detail";
import { type mySalesSearchSchema } from "./sales.functions";
import { mySalesQuery } from "./sales.queries";

type Filters = z.infer<typeof mySalesSearchSchema>;

// Le repère de synchronisation d'une adresse : un filtre posé remet la
// liste à la première page.
const FIRST_PAGE = { page: 1 } as const;

// « Mes ventes » : les ventes que l'appelant a lui-même encaissées (le
// vendeur vient de la session, jamais de l'adresse). Les filtres vivent
// dans l'adresse, donc partageables et survivant au rechargement.
export function MySales({
  locale,
  search,
  onSearch,
}: {
  locale: Locale;
  search: Filters;
  // Un filtre change : la page revient à la première.
  onSearch: (filters: Partial<Filters>) => void;
}) {
  const t = useTranslations("mySales");
  const tCommon = useTranslations("common");
  const tSales = useTranslations("sales");
  const format = useFormatter();
  const money = useMoney();
  const paymentLabel = usePaymentLabel();
  const { data } = useSuspenseQuery(mySalesQuery(search));
  // La référence est saisie, donc synchronisée un instant après la frappe ;
  // les autres filtres s'appliquent tout de suite.
  const [text, setText] = useState(search.q ?? "");

  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === search.q) return;
    const timer = setTimeout(() => onSearch({ q, ...FIRST_PAGE }), 300);
    return () => clearTimeout(timer);
  }, [text, search.q, onSearch]);

  const setFilter = (key: "from" | "to" | "status" | "payment") => (value: string) =>
    onSearch({ [key]: value || undefined, ...FIRST_PAGE });
  const reset = () => {
    setText("");
    onSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      status: undefined,
      payment: undefined,
      ...FIRST_PAGE,
    });
  };
  const hasFilters = Boolean(
    search.q || search.from || search.to || search.status || search.payment,
  );
  // Un portefeuille nommé dans l'adresse mais depuis supprimé de la
  // boutique garde quand même son option, pour que le select ne soit pas
  // vide.
  const urlProvider = search.payment?.startsWith("wallet:")
    ? search.payment.slice("wallet:".length)
    : "";
  const providers =
    urlProvider && !data.walletProviders.includes(urlProvider)
      ? [...data.walletProviders, urlProvider]
      : data.walletProviders;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeaderWithBack title={t("title")} locale={locale} backLabel={t("backToCheckout")} />

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:items-end">
          <Field label={t("reference")} className="col-span-2 sm:col-span-3 lg:col-span-2">
            {(control) => (
              <Input
                {...control}
                type="search"
                placeholder="VNT-..."
                leading={<Icon name="search" className="size-4" />}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("from")}>
            {(control) => (
              <Input
                {...control}
                type="date"
                max={search.to || undefined}
                value={search.from ?? ""}
                onChange={(event) => setFilter("from")(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("to")}>
            {(control) => (
              <Input
                {...control}
                type="date"
                min={search.from || undefined}
                value={search.to ?? ""}
                onChange={(event) => setFilter("to")(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("status")}>
            {(control) => (
              <Select
                {...control}
                value={search.status ?? ""}
                onChange={(event) => setFilter("status")(event.target.value)}
              >
                <option value="">{t("allStatuses")}</option>
                {SALE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tSales(`saleStatus.${status}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("payment")}>
            {(control) => (
              <Select
                {...control}
                value={search.payment ?? ""}
                onChange={(event) => setFilter("payment")(event.target.value)}
              >
                <option value="">{t("allPayments")}</option>
                <option value="cash">{t("cash")}</option>
                {providers.map((provider) => (
                  <option key={provider} value={`wallet:${provider}`}>
                    {provider}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {hasFilters && (
            <Button
              variant="quiet"
              size="sm"
              className="col-span-2 justify-self-start sm:col-span-3 lg:col-span-5"
              onClick={reset}
            >
              {tCommon("resetFilters")}
            </Button>
          )}
        </div>
      </Card>

      <SummaryTiles summary={data.summary} money={money} t={t} />

      {data.sales.length === 0 ? (
        <EmptyState icon="sales" title={hasFilters ? tCommon("noResults") : t("noSales")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.sales.map((sale) => {
            const cancelled = sale.status === "CANCELLED";
            return (
              <li
                key={sale.id}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/$locale/admin/pos/receipt/$saleId"
                      params={{ locale, saleId: sale.id }}
                      className="font-semibold text-ink no-underline hover:text-brand hover:underline"
                    >
                      {sale.reference}
                    </Link>
                    <Status tone={SALE_TONE[sale.status] ?? "mute"}>
                      {tSales(`saleStatus.${sale.status}`)}
                    </Status>
                  </div>
                  <span className="text-[13px] text-muted">
                    {format.dateTime(sale.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <ul className="flex flex-col text-[14px]">
                  {sale.items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {item.name}{" "}
                        <span className="text-muted">
                          · {item.size} · {item.color}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2 text-[14px]">
                  <span className="text-muted">
                    {paymentLabel(sale.paymentMethod, sale.walletProvider)}
                    {sale.clientName && ` · ${sale.clientName}`}
                  </span>
                  <span
                    className={
                      cancelled
                        ? "font-semibold text-muted line-through tabular-nums"
                        : "font-semibold tabular-nums"
                    }
                  >
                    {money(sale.total)}
                    {sale.refundedAmount > 0 && !cancelled && (
                      <span className="ms-2 text-[12px] font-normal text-muted">
                        {t("refundedPart", { amount: money(sale.refundedAmount) })}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        rangeLabel={(range) => tCommon("paginationRange", range)}
        previousLabel={tCommon("previous")}
        nextLabel={tCommon("next")}
        onPageChange={(page) => onSearch({ page })}
      />
    </div>
  );
}

// Le haut de page : le titre et le retour à la caisse (en arabe, la flèche
// du retour se retourne avec la lecture).
function PageHeaderWithBack({
  title,
  locale,
  backLabel,
}: {
  title: string;
  locale: Locale;
  backLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-page-title">{title}</h1>
      <ButtonLink to="/$locale/admin/pos" params={{ locale }}>
        <Icon name="chevronLeft" />
        {backLabel}
      </ButtonLink>
    </div>
  );
}

// Les tuiles au-dessus de la liste : le compte des ventes (les annulées
// comptées à part), le total encaissé, les remboursements, puis l'encaissé
// par mode de paiement.
function SummaryTiles({
  summary,
  money,
  t,
}: {
  summary: {
    salesCount: number;
    cancelledCount: number;
    soldTotal: number;
    refundedTotal: number;
    breakdown: Array<{ method: string; provider: string | null; total: number; count: number }>;
  };
  money: (amount: number) => string;
  t: ReturnType<typeof useTranslations<"mySales">>;
}) {
  const tiles: Array<{ label: string; value: string; hint?: string; strong?: boolean }> = [
    {
      label: t("salesCount"),
      value: String(summary.salesCount),
      hint:
        summary.cancelledCount > 0
          ? t("cancelledCount", { count: summary.cancelledCount })
          : undefined,
    },
    { label: t("soldTotal"), value: money(summary.soldTotal), strong: true },
    ...(summary.refundedTotal > 0
      ? [{ label: t("refundedTotal"), value: `−${money(summary.refundedTotal)}` }]
      : []),
    ...summary.breakdown.map((row) => ({
      label:
        row.method === "cash"
          ? t("collectedCash")
          : row.method === "wallet"
            ? t("collectedWallet", { wallet: row.provider ?? t("wallet") })
            : t("collectedOther"),
      value: money(row.total),
    })),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3"
        >
          <span className="text-[12px] text-muted">{tile.label}</span>
          <span
            dir="ltr"
            className={
              tile.strong
                ? "text-start text-[18px] font-semibold tabular-nums rtl:text-end"
                : "text-start text-[18px] tabular-nums rtl:text-end"
            }
          >
            {tile.value}
          </span>
          {tile.hint && <span className="text-[12px] text-muted">{tile.hint}</span>}
        </div>
      ))}
    </div>
  );
}
