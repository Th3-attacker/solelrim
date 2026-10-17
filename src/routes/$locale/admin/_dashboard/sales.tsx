import { Suspense, useEffect, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";
import { toCsv } from "@/lib/shop/csv";
import { cn } from "~/lib/cn";
import { Button, ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Sheet } from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { PageHeader } from "~/components/ui/page-header";
import { Skeleton } from "~/components/ui/skeleton";
import { Status } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import { Pagination } from "~/components/table/data-table";
import { useMoney } from "~/features/pos/till-parts";
import { RefundsPanel } from "~/features/sales/refunds-panel";
import { SALE_TONE, SaleDetail, usePaymentLabel } from "~/features/sales/sale-detail";
import { REFUND_FILTERS, exportSales } from "~/features/sales/sales.functions";
import { refundsQuery, saleQuery, salesListQuery } from "~/features/sales/sales.queries";

const searchSchema = z.object({
  tab: z.enum(["sales", "refunds"]).catch("sales").default("sales"),
  q: z.string().trim().max(40).optional().catch(undefined),
  refunds: z.enum(REFUND_FILTERS).catch("PENDING").default("PENDING"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  // The sale open in the side panel: in the address, so it can be shared
  // and the back button closes it.
  sale: z.string().max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/$locale/admin/_dashboard/sales")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "sales", refunds: "PENDING", page: 1 })] },
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    q: search.q,
    refunds: search.refunds,
    page: search.page,
  }),
  loader: ({ context: { queryClient }, deps }) =>
    deps.tab === "sales"
      ? queryClient.ensureQueryData(salesListQuery({ q: deps.q, page: deps.page }))
      : queryClient.ensureQueryData(refundsQuery(deps.refunds, deps.page)),
  staticData: { section: "admin.nav.salesGroup", title: "nav.sales" },
  component: SalesPage,
});

function SalesPage() {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const { locale } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: first } = useSuspenseQuery(salesListQuery({ page: 1 }));
  const csv = useSalesCsv();

  const tab =
    "inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-0.5 text-[14px] font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-brand";

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button busy={csv.busy} onClick={() => void csv.download({ q: search.q })}>
              <Icon name="download" />
              {tCommon("exportCsv")}
            </Button>
            <ButtonLink variant="primary" to="/$locale/admin/pos" params={{ locale }}>
              <Icon name="plus" />
              {t("newSale")}
            </ButtonLink>
          </>
        }
      />

      <Summary summary={first.summary} />

      <Card as="section" aria-label={t("title")} className="overflow-hidden">
        <nav aria-label={t("tabsLabel")} className="flex gap-6 border-b border-line-soft px-5">
          <Link
            to="."
            search={(prev) => ({ ...prev, tab: "sales", page: 1 })}
            className={tab}
            aria-current={search.tab === "sales" ? "page" : undefined}
          >
            {t("title")}
          </Link>
          <Link
            to="."
            search={(prev) => ({ ...prev, tab: "refunds", page: 1 })}
            className={tab}
            aria-current={search.tab === "refunds" ? "page" : undefined}
          >
            {t("refundsTab")}
            {first.summary.pendingRefunds > 0 && (
              <span className="rounded-full bg-pend-bg px-1.5 text-[11px] font-bold text-pend-ink">
                {first.summary.pendingRefunds}
              </span>
            )}
          </Link>
        </nav>
        {search.tab === "sales" ? <SalesList /> : <RefundsList />}
      </Card>

      <Sheet
        open={Boolean(search.sale)}
        onOpenChange={(open) => {
          if (!open)
            void navigate({ search: (prev) => ({ ...prev, sale: undefined }), resetScroll: false });
        }}
        side="end"
        title={t("saleDetailTitle")}
      >
        {search.sale && (
          <Suspense fallback={<SaleSkeleton />}>
            <SaleDetail saleId={search.sale} locale={locale} />
          </Suspense>
        )}
      </Sheet>
    </div>
  );
}

function SaleSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Summary({
  summary,
}: {
  summary: { collected: number; completed: number; averageBasket: number; refunded: number };
}) {
  const t = useTranslations("sales");
  const money = useMoney();
  const tiles = [
    [t("collected"), money(summary.collected)],
    [t("completedCount"), String(summary.completed)],
    [t("averageBasket"), money(summary.averageBasket)],
    [t("refundedAmount"), money(summary.refunded)],
  ];
  return (
    <Card as="section" aria-label={t("summaryLabel")}>
      <dl className="grid grid-cols-2 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 border-line-soft p-5 not-last:border-b md:border-b-0 md:not-last:border-e"
          >
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="text-[22px] font-bold text-brand tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SalesList() {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const money = useMoney();
  const paymentLabel = usePaymentLabel();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(salesListQuery({ q: search.q, page: search.page }));
  const [text, setText] = useState(search.q ?? "");

  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === search.q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          search: (prev) => ({ ...prev, q, page: 1 }),
          replace: true,
          resetScroll: false,
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [text, search.q, navigate]);

  const open = (saleId: string) => {
    void navigate({ search: (prev) => ({ ...prev, sale: saleId }), resetScroll: false });
  };
  const cell = "border-b border-line-soft px-4 py-3 text-start whitespace-nowrap";
  const head =
    "border-b border-line-soft bg-surface-2 px-4 py-2.5 text-start text-[12px] font-medium text-muted";

  return (
    <>
      <search className="border-b border-line-soft p-3">
        <Input
          type="search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          leading={<Icon name="search" className="text-muted" />}
          className="h-10 sm:w-72"
        />
      </search>
      {data.rows.length === 0 ? (
        <EmptyState icon="sales" title={search.q ? tCommon("noResults") : t("noSales")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px] tabular-nums">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col" className={head}>
                  {t("reference")}
                </th>
                <th scope="col" className={head}>
                  {t("client")}
                </th>
                <th scope="col" className={head}>
                  {t("paymentMethod")}
                </th>
                <th scope="col" className={cn(head, "text-end")}>
                  {t("total")}
                </th>
                <th scope="col" className={head}>
                  {t("status")}
                </th>
                <th scope="col" className={head}>
                  {t("date")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-surface-2 [&:last-child>*]:border-b-0"
                  onPointerEnter={() => void queryClient.prefetchQuery(saleQuery(sale.id))}
                >
                  <th scope="row" className={cn(cell, "font-semibold")}>
                    <button
                      type="button"
                      onClick={() => open(sale.id)}
                      className="font-semibold text-ink hover:text-brand hover:underline"
                    >
                      {sale.reference}
                    </button>
                  </th>
                  <td className={cell}>{sale.client ?? t("walkInClient")}</td>
                  <td className={cn(cell, "text-muted")}>
                    {paymentLabel(sale.paymentMethod, sale.walletProvider)}
                  </td>
                  <td className={cn(cell, "text-end font-semibold")}>{money(sale.total)}</td>
                  <td className={cell}>
                    <Status tone={SALE_TONE[sale.status] ?? "mute"}>
                      {t(`saleStatus.${sale.status}`)}
                    </Status>
                  </td>
                  <td className={cn(cell, "text-muted")}>
                    {format.dateTime(sale.createdAt, { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={search.page}
        pageSize={data.pageSize}
        total={data.total}
        rangeLabel={(range) => tCommon("paginationRange", range)}
        previousLabel={tCommon("previous")}
        nextLabel={tCommon("next")}
        onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
      />
    </>
  );
}

// L'onglet remboursements : le panneau partagé, avec les liens de cette
// page — une référence ouvre le panneau de la vente.
function RefundsList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <RefundsPanel
      status={search.refunds}
      page={search.page}
      onStatusChange={(refunds) =>
        void navigate({ search: (prev) => ({ ...prev, refunds, page: 1 }), resetScroll: false })
      }
      onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
      renderSaleLink={(request) => (
        <button
          type="button"
          className="text-[13px] font-semibold text-brand hover:underline"
          onClick={() =>
            void navigate({
              search: (prev) => ({ ...prev, sale: request.saleId }),
              resetScroll: false,
            })
          }
        >
          {request.saleReference}
        </button>
      )}
    />
  );
}

// A CSV of the sales the search matches, read when asked.
function useSalesCsv() {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const money = useMoney();
  const paymentLabel = usePaymentLabel();
  const [busy, setBusy] = useState(false);
  async function download(filters: { q?: string }) {
    setBusy(true);
    try {
      const rows = await exportSales({ data: filters });
      const csv = toCsv(
        [
          { key: "reference", label: t("reference") },
          { key: "client", label: t("client") },
          { key: "payment", label: t("paymentMethod") },
          { key: "total", label: t("total") },
          { key: "refunded", label: t("refundedAmount") },
          { key: "status", label: t("status") },
          { key: "date", label: t("date") },
        ],
        rows.map((row) => ({
          reference: row.reference,
          client: row.client ?? t("walkInClient"),
          payment: paymentLabel(row.paymentMethod, row.walletProvider),
          total: money(row.total),
          refunded: money(row.refundedAmount),
          status: t(`saleStatus.${row.status}`),
          date: format.dateTime(row.createdAt, { dateStyle: "medium" }),
        })),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      Object.assign(document.createElement("a"), {
        href: url,
        download: `ventes-${new Date().toISOString().slice(0, 10)}.csv`,
      }).click();
      URL.revokeObjectURL(url);
    } catch {
      notify({ tone: "error", title: tCommon("error") });
    } finally {
      setBusy(false);
    }
  }
  return { download, busy };
}
