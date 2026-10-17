import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "use-intl";
import { formatPriceNumber } from "@/lib/format/currency";
import { Card } from "~/components/ui/card";
import { Button, ButtonLink } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Icon } from "~/components/ui/icon";
import { PageHeader } from "~/components/ui/page-header";
import { Status } from "~/components/ui/status";
import {
  DataTable,
  Pagination,
  adminColumns,
  adminTableFeatures,
  selectionColumn,
} from "~/components/table/data-table";
import { ORDER_STATUS } from "~/features/orders/order-status";
import { orderListQuery } from "~/features/orders/orders.queries";
import { orderListSearchSchema, type OrderListSearch } from "~/features/orders/orders.schemas";
import {
  DateFilter,
  OrderCards,
  OrderSearch,
  PendingAge,
  SelectionActions,
  StatusTabs,
  useOrdersCsv,
  type OrderRow,
} from "~/features/orders/order-list";

export const Route = createFileRoute("/$locale/admin/_dashboard/orders/")({
  validateSearch: orderListSearchSchema,
  // Defaults stay out of the address.
  search: { middlewares: [stripSearchParams({ status: "pending", page: 1 })] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(orderListQuery(deps)),
  staticData: { section: "admin.nav.salesGroup", title: "nav.orders" },
  component: OrdersPage,
});

const helper = adminColumns<OrderRow>();

function OrdersPage() {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const { locale } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  // The loader read it before the page showed; while the next filters load,
  // the router keeps this page on screen.
  const { data: list } = useSuspenseQuery(orderListQuery(search));
  const tTable = useTranslations("admin.table");
  const csv = useOrdersCsv();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const setSearch = useCallback(
    (next: Partial<OrderListSearch>) => {
      setRowSelection({});
      void navigate({
        search: (prev) => ({ ...prev, ...next, page: next.page ?? 1 }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  // The next page is read before it's asked for.
  const lastPage = Math.max(1, Math.ceil(list.total / list.pageSize));
  useEffect(() => {
    if (search.page < lastPage) {
      void queryClient.prefetchQuery(orderListQuery({ ...search, page: search.page + 1 }));
    }
  }, [queryClient, search, lastPage]);

  const columns = useMemo(
    () =>
      helper.columns([
        selectionColumn<OrderRow>({
          selectAllLabel: tTable("selectAllOnPage"),
          rowLabel: (order) => t("selectOrder", { reference: order.reference }),
        }),
        helper.accessor("reference", {
          header: t("reference"),
          enableSorting: false,
          meta: { rowHeader: true },
          cell: ({ row }) => (
            <Link
              to="/$locale/admin/orders/$orderId"
              params={{ locale, orderId: row.original.id }}
              className="font-semibold text-ink no-underline hover:text-brand hover:underline"
            >
              {row.original.reference}
            </Link>
          ),
        }),
        helper.accessor("customerName", { header: t("customer"), enableSorting: false }),
        helper.accessor("customerPhone", {
          header: t("phone"),
          enableSorting: false,
          cell: ({ getValue }) => (
            <span dir="ltr" className="text-muted">
              {getValue()}
            </span>
          ),
        }),
        helper.accessor("total", {
          header: t("total"),
          enableSorting: false,
          meta: { align: "end" },
          cell: ({ getValue }) => (
            <b className="font-semibold">
              {formatPriceNumber(getValue())} {tCommon("currency")}
            </b>
          ),
        }),
        helper.accessor("status", {
          header: t("status"),
          enableSorting: false,
          cell: ({ row }) => {
            const status = ORDER_STATUS[row.original.status];
            return (
              <>
                <Status tone={status.tone}>{t(status.label)}</Status>
                {row.original.status === "PENDING" && (
                  <PendingAge
                    createdAt={row.original.createdAt}
                    now={list.now}
                    staleAfterHours={list.staleAfterHours}
                  />
                )}
              </>
            );
          },
        }),
        helper.accessor("createdAt", {
          header: t("date"),
          enableSorting: false,
          cell: ({ getValue }) => <OrderDate date={getValue()} />,
        }),
        helper.display({
          id: "action",
          header: () => <span className="sr-only">{tCommon("actions")}</span>,
          meta: { align: "end" },
          cell: ({ row }) => (
            <ButtonLink
              size="sm"
              to="/$locale/admin/orders/$orderId"
              params={{ locale, orderId: row.original.id }}
              aria-label={`${t(row.original.status === "PENDING" ? "verifyAction" : "openAction")} ${row.original.reference}`}
            >
              {t(row.original.status === "PENDING" ? "verifyAction" : "openAction")}
            </ButtonLink>
          ),
        }),
      ]),
    [t, tCommon, tTable, locale, list.now, list.staleAfterHours],
  );

  const table = useTable({
    features: adminTableFeatures,
    columns,
    data: list.rows,
    getRowId: (order) => order.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const { page: _page, ...filters } = search;
  const filtered = Boolean(search.q || search.from || search.to);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader
        title={t("title")}
        description={t("listDescription")}
        actions={
          <Button busy={csv.busy} onClick={() => void csv.download(filters)}>
            <Icon name="download" />
            {tCommon("exportCsv")}
          </Button>
        }
      />

      <Card as="section" aria-label={t("title")} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-3">
          <StatusTabs locale={locale} current={search.status} counts={list.tabCounts} />
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <OrderSearch value={search.q} onSearch={(q) => setSearch({ q })} />
            <DateFilter
              from={search.from}
              to={search.to}
              now={list.now}
              onChange={(range) => setSearch(range)}
            />
          </div>
        </div>

        {list.rows.length === 0 ? (
          <EmptyState
            icon={filtered ? "search" : "orders"}
            title={filtered ? t("noOrdersMatching") : t("noOrders")}
            action={
              filtered ? (
                <Button onClick={() => setSearch({ q: undefined, from: undefined, to: undefined })}>
                  {t("resetFilters")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable
                table={table}
                caption={t("title")}
                selectionBar={(selected) => (
                  <SelectionActions
                    selected={selected}
                    locale={locale}
                    onClear={() => setRowSelection({})}
                  />
                )}
              />
            </div>
            <OrderCards
              rows={list.rows}
              locale={locale}
              now={list.now}
              staleAfterHours={list.staleAfterHours}
            />
          </>
        )}

        <Pagination
          page={search.page}
          pageSize={list.pageSize}
          total={list.total}
          rangeLabel={(range) => tCommon("paginationRange", range)}
          previousLabel={tCommon("previous")}
          nextLabel={tCommon("next")}
          onPageChange={(page) => setSearch({ page })}
        />
      </Card>
    </div>
  );
}

function OrderDate({ date }: { date: Date }) {
  const format = useFormatter();
  return (
    <time dateTime={date.toISOString()} className="text-muted">
      {format.dateTime(date, { day: "numeric", month: "short" })}
    </time>
  );
}
