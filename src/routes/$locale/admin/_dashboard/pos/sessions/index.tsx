import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { cn } from "~/lib/cn";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { PageHeader } from "~/components/ui/page-header";
import { Status } from "~/components/ui/status";
import { Pagination } from "~/components/table/data-table";
import { tillsQuery } from "~/features/pos/pos.queries";
import { DifferenceStatus, useMoney } from "~/features/pos/till-parts";
import { CashTabs } from "~/features/pos/cash-tabs";

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/sessions/")({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).catch(1).default(1) }),
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(tillsQuery(deps.page)),
  staticData: { section: "admin.nav.salesGroup", title: "cash.sessionsTitle" },
  component: SessionsPage,
});

function SessionsPage() {
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const money = useMoney();
  const { locale, admin } = Route.useRouteContext();
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(tillsQuery(page));
  const cell = "border-b border-line-soft px-4 py-3 text-start whitespace-nowrap";
  const head =
    "border-b border-line-soft bg-surface-2 px-4 py-2.5 text-start text-[12px] font-medium text-muted";

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader title={t("sessionsTitle")} description={t("sessionsDescription")} />
      <Card as="section" aria-label={t("sessionsTitle")} className="overflow-hidden">
        {admin.role !== "SELLER" && <CashTabs locale={locale} current="sessions" />}
        {data.sessions.length === 0 ? (
          <EmptyState icon="clock" title={t("noSessions")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px] tabular-nums">
              <caption className="sr-only">{t("sessionsTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    {t("openedAtColumn")}
                  </th>
                  <th scope="col" className={head}>
                    {t("seller")}
                  </th>
                  <th scope="col" className={head}>
                    {t("status")}
                  </th>
                  <th scope="col" className={cn(head, "text-end")}>
                    {t("openingFloat")}
                  </th>
                  <th scope="col" className={cn(head, "text-end")}>
                    {t("expectedCash")}
                  </th>
                  <th scope="col" className={cn(head, "text-end")}>
                    {t("countedCash")}
                  </th>
                  <th scope="col" className={head}>
                    {t("difference")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface-2 [&:last-child>*]:border-b-0">
                    <th scope="row" className={cn(cell, "font-semibold")}>
                      <Link
                        to="/$locale/admin/pos/sessions/$sessionId"
                        params={{ locale, sessionId: session.id }}
                        className="text-ink no-underline hover:text-brand hover:underline"
                      >
                        {format.dateTime(session.openedAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Link>
                    </th>
                    <td className={cell}>{session.sellerEmail}</td>
                    <td className={cell}>
                      <Status tone={session.status === "OPEN" ? "ok" : "mute"}>
                        {t(session.status === "OPEN" ? "statusOpen" : "statusClosed")}
                      </Status>
                    </td>
                    <td className={cn(cell, "text-end")}>{money(session.openingFloat)}</td>
                    <td className={cn(cell, "text-end")}>
                      {session.expectedCash === null ? "—" : money(session.expectedCash)}
                    </td>
                    <td className={cn(cell, "text-end")}>
                      {session.countedCash === null ? "—" : money(session.countedCash)}
                    </td>
                    <td className={cell}>
                      {session.status === "OPEN" ? (
                        "—"
                      ) : (
                        <DifferenceStatus difference={session.cashDifference} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          rangeLabel={(range) => tCommon("paginationRange", range)}
          previousLabel={tCommon("previous")}
          nextLabel={tCommon("next")}
          onPageChange={(next) => void navigate({ search: { page: next } })}
        />
      </Card>
    </div>
  );
}
