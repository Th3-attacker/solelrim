import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import { Status } from "~/components/ui/status";
import { tillQuery } from "~/features/pos/pos.queries";
import { CloseTillForm, DifferenceStatus, TillTotals, useMoney } from "~/features/pos/till-parts";
import { MovementList, SessionSales } from "~/features/pos/till-views";

// One till: its figures (frozen once closed), movements, sales, and its
// closing when it is still open and the caller may close it.
export const Route = createFileRoute("/$locale/admin/_dashboard/pos/sessions/$sessionId")({
  loader: async ({ context: { queryClient }, params }) => {
    if (!(await queryClient.ensureQueryData(tillQuery(params.sessionId)))) throw notFound();
  },
  staticData: { section: "admin.nav.salesGroup", title: "cash.sessionsTitle" },
  component: SessionPage,
});

function SessionPage() {
  const t = useTranslations("cash");
  const format = useFormatter();
  const money = useMoney();
  const { locale } = Route.useRouteContext();
  const { sessionId } = Route.useParams();
  const { data: session } = useSuspenseQuery(tillQuery(sessionId));
  if (!session) return null;
  const open = session.status === "OPEN";

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <div>
        <ButtonLink
          variant="quiet"
          size="sm"
          className="-ms-2.5"
          to="/$locale/admin/pos/sessions"
          params={{ locale }}
        >
          <Icon name="chevronLeft" className="size-4" />
          {t("sessionsTitle")}
        </ButtonLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-page-title">
            {t("sessionTitle", {
              date: format.dateTime(session.businessDate, { dateStyle: "long", timeZone: "UTC" }),
            })}
          </h1>
          <Status tone={open ? "ok" : "mute"}>{t(open ? "statusOpen" : "statusClosed")}</Status>
        </div>
        <p className="mt-1 text-[14px] text-muted">
          {session.sellerEmail} ·{" "}
          {t("openedAt", { date: format.dateTime(session.openedAt, { timeStyle: "short" }) })}
          {session.closedAt && (
            <>
              {" "}
              · {t("closedAt", { date: format.dateTime(session.closedAt, { timeStyle: "short" }) })}
            </>
          )}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Card as="section" aria-labelledby="session-sales" className="overflow-hidden">
            <h2 id="session-sales" className="px-5 pt-5 pb-3 text-card-title">
              {t("salesTitle")}
            </h2>
            <SessionSales sales={session.sales} locale={locale} />
          </Card>
          <Card as="section" aria-labelledby="session-movements" className="p-5">
            <h2 id="session-movements" className="mb-2 text-card-title">
              {t("movementsTitle")}
            </h2>
            <MovementList movements={session.movements} />
          </Card>
        </div>
        <aside className="flex flex-col gap-5">
          <Card as="section" aria-labelledby="session-summary" className="p-5">
            <h2 id="session-summary" className="mb-3 text-card-title">
              {t("summary")}
            </h2>
            <TillTotals totals={session.totals} />
            {!open && (
              <dl className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("countedCash")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {session.countedCash === null ? "—" : money(session.countedCash)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("difference")}</dt>
                  <dd>
                    <DifferenceStatus difference={session.cashDifference} />
                  </dd>
                </div>
                {session.autoClosed && (
                  <p className="text-[13px] text-warn-ink">{t("autoClosedNote")}</p>
                )}
                {session.closingNote && (
                  <p className="text-[13px] text-ink-2">« {session.closingNote} »</p>
                )}
              </dl>
            )}
          </Card>
          {open && session.closable && (
            <Card as="section" aria-labelledby="session-close" className="p-5">
              <h2 id="session-close" className="mb-3 text-card-title">
                {t("closeTitle")}
              </h2>
              <CloseTillForm
                sessionId={session.id}
                expectedCash={session.totals.expectedCash}
                onClosed={() => {}}
              />
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
