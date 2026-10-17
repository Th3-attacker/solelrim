import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { cn } from "~/lib/cn";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ConfirmDialog } from "~/components/ui/dialog";
import { Field, Input } from "~/components/ui/field";
import { PageHeader } from "~/components/ui/page-header";
import { Status } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import { CashTabs } from "~/features/pos/cash-tabs";
import { closuresQuery } from "~/features/pos/pos.queries";
import { closeDay } from "~/features/pos/till.functions";
import { DifferenceStatus, TillTotals, useMoney } from "~/features/pos/till-parts";
import { useCommandError } from "~/features/pos/use-command-error";

// The boutique's day: every till of that date, the day consolidated, and its
// closure (once, when every till is closed). Below, the last closures.
export const Route = createFileRoute("/$locale/admin/_dashboard/cash-closures")({
  validateSearch: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .catch(undefined),
  }),
  search: { middlewares: [stripSearchParams({ date: undefined })] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(closuresQuery(deps.date)),
  staticData: { section: "admin.nav.salesGroup", title: "nav.cashClosures" },
  component: ClosuresPage,
});

function ClosuresPage() {
  const t = useTranslations("cash");
  const format = useFormatter();
  const money = useMoney();
  const queryClient = useQueryClient();
  const showError = useCommandError("cash.error");
  const { locale } = Route.useRouteContext();
  const { date } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(closuresQuery(date));
  const day = data.day;
  const dayLabel = format.dateTime(new Date(`${data.date}T00:00:00Z`), {
    dateStyle: "full",
    timeZone: "UTC",
  });

  const close = useMutation({
    mutationFn: () => closeDay({ data: { date: data.date } }),
    onSuccess: async (result) => {
      if (result.error) return showError(result.error);
      notify({ title: t("dayClosedToast") });
      await queryClient.invalidateQueries({ queryKey: ["till"] });
    },
    onError: showError,
  });

  const cell = "border-b border-line-soft px-4 py-3 text-start whitespace-nowrap";
  const head =
    "border-b border-line-soft bg-surface-2 px-4 py-2.5 text-start text-[12px] font-medium text-muted";

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader
        title={t("closuresTitle")}
        description={t("closuresDescription")}
        actions={
          !day.closure && day.sessions.length > 0 ? (
            <ConfirmDialog
              trigger={
                <Button variant="primary" disabled={day.openCount > 0} busy={close.isPending}>
                  {t("closeDayAction")}
                </Button>
              }
              title={t("closeDayConfirmTitle", { date: dayLabel })}
              description={t("closeDayConfirm")}
              cancelLabel={t("goBack")}
              confirmLabel={t("closeDayAction")}
              tone="primary"
              onConfirm={() => close.mutate()}
            />
          ) : undefined
        }
      />

      <Card as="section" aria-labelledby="day-title" className="overflow-hidden">
        <CashTabs locale={locale} current="closures" />
        <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-3">
          <div>
            <h2 id="day-title" className="text-card-title first-letter:uppercase">
              {dayLabel}
            </h2>
            {day.closure ? (
              <p className="mt-1 text-[13px] text-muted">
                <Status tone="ok" className="me-2">
                  {t("dayClosedTitle")}
                </Status>
                {t("dayClosedBy", {
                  email: day.closure.closedByEmail,
                  date: format.dateTime(day.closure.closedAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
            ) : day.openCount > 0 ? (
              <p className="mt-1 text-[13px] text-warn-ink">
                {t("openSessionsHint", { count: day.openCount })}
              </p>
            ) : null}
          </div>
          <Field label={t("day")} className="w-44">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={data.date}
                max={data.today}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value)
                    void navigate({ search: { date: value === data.today ? undefined : value } });
                }}
                className="h-10"
              />
            )}
          </Field>
        </div>

        {day.sessions.length === 0 ? (
          <p className="px-5 pb-5 text-[14px] text-muted">{t("noSessionsThatDay")}</p>
        ) : (
          <div className="grid gap-5 p-5 pt-2 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-x-auto rounded-control border border-line-soft">
              <table className="w-full border-collapse text-[14px] tabular-nums">
                <caption className="sr-only">{t("sessionsTitle")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={head}>
                      {t("seller")}
                    </th>
                    <th scope="col" className={head}>
                      {t("status")}
                    </th>
                    <th scope="col" className={cn(head, "text-end")}>
                      {t("salesTotal")}
                    </th>
                    <th scope="col" className={cn(head, "text-end")}>
                      {t("expectedCash")}
                    </th>
                    <th scope="col" className={head}>
                      {t("difference")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {day.sessions.map((session) => (
                    <tr key={session.id} className="[&:last-child>*]:border-b-0">
                      <th scope="row" className={cn(cell, "font-medium")}>
                        {session.sellerEmail}
                      </th>
                      <td className={cell}>
                        <Status tone={session.status === "OPEN" ? "ok" : "mute"}>
                          {t(session.status === "OPEN" ? "statusOpen" : "statusClosed")}
                        </Status>
                      </td>
                      <td className={cn(cell, "text-end")}>{money(session.totals.salesTotal)}</td>
                      <td className={cn(cell, "text-end")}>{money(session.totals.expectedCash)}</td>
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
            <section aria-labelledby="day-total" className="rounded-control bg-bg p-4">
              <h3 id="day-total" className="mb-2 text-[14px] font-bold">
                {day.closure ? t("dayClosedTitle") : t("dayPreviewTitle")}
              </h3>
              <TillTotals totals={day.consolidated} />
              <div className="mt-2 flex justify-between gap-3 border-t border-line pt-2 text-[14px]">
                <span className="text-muted">{t("countedCash")}</span>
                <b className="tabular-nums">{money(day.closure?.countedCash ?? day.countedCash)}</b>
              </div>
            </section>
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="recent-closures" className="overflow-hidden">
        <h2 id="recent-closures" className="px-5 pt-5 pb-3 text-card-title">
          {t("recentClosures")}
        </h2>
        {data.closures.length === 0 ? (
          <p className="px-5 pb-5 text-[14px] text-muted">{t("noClosures")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px] tabular-nums">
              <caption className="sr-only">{t("recentClosures")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    {t("day")}
                  </th>
                  <th scope="col" className={cn(head, "text-end")}>
                    {t("sessionCount")}
                  </th>
                  <th scope="col" className={cn(head, "text-end")}>
                    {t("salesTotal")}
                  </th>
                  <th scope="col" className={head}>
                    {t("difference")}
                  </th>
                  <th scope="col" className={head}>
                    {t("closedBy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.closures.map((closure) => {
                  const value = closure.businessDate.toISOString().slice(0, 10);
                  return (
                    <tr key={closure.id} className="hover:bg-surface-2 [&:last-child>*]:border-b-0">
                      <th scope="row" className={cn(cell, "font-semibold")}>
                        <button
                          type="button"
                          className="font-semibold text-ink hover:text-brand hover:underline first-letter:uppercase"
                          onClick={() =>
                            void navigate({
                              search: { date: value === data.today ? undefined : value },
                            })
                          }
                        >
                          {format.dateTime(closure.businessDate, {
                            dateStyle: "full",
                            timeZone: "UTC",
                          })}
                        </button>
                      </th>
                      <td className={cn(cell, "text-end")}>{closure.sessionCount}</td>
                      <td className={cn(cell, "text-end font-semibold")}>
                        {money(closure.salesTotal)}
                      </td>
                      <td className={cell}>
                        <DifferenceStatus difference={closure.cashDifference} />
                      </td>
                      <td className={cn(cell, "text-muted")}>{closure.closedByEmail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
