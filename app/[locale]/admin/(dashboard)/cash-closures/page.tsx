import { CashRegister } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { getDayView, listDayClosures } from "@/lib/queries/cash-sessions";
import { businessDateOf, formatBusinessDate, parseBusinessDate } from "@/lib/shop/cash";
import { formatPrice } from "@/lib/format/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state-message";
import { SessionTotalsView } from "@/components/cash/session-totals";
import { SessionStatusBadge } from "@/components/cash/session-status-badge";
import { CashDifference } from "@/components/cash/cash-difference";
import { CloseDayButton } from "@/components/cash/close-day-button";
import { DayPicker } from "@/components/cash/day-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusAlert } from "@/components/ui/status-alert";

// The boutique admin's daily closure (requireAdminScope refuses a seller;
// proxy.ts redirects them before that).
export default async function CashClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { productType } = await requireAdminScope();
  const { date: dateParam } = await searchParams;
  const today = businessDateOf(new Date());
  const requested = dateParam ? parseBusinessDate(dateParam) : null;
  const businessDate = requested && requested <= today ? requested : today;
  const date = formatBusinessDate(businessDate);

  const [day, closures, t, tCommon, format] = await Promise.all([
    getDayView(productType, businessDate),
    listDayClosures(productType),
    getTranslations("cash"),
    getTranslations("common"),
    getFormatter(),
  ]);
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));
  const closure = day.closure;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("closuresTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("closuresHint")}</p>
        </div>
        <DayPicker value={date} max={formatBusinessDate(today)} />
      </div>

      {day.sessions.length === 0 ? (
        <StateMessage icon={CashRegister} title={t("noSessionsThatDay")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("seller")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("salesTotal")}</TableHead>
                <TableHead>{t("expectedCash")}</TableHead>
                <TableHead>{t("countedCash")}</TableHead>
                <TableHead>{t("difference")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Link
                      href={`/admin/pos/sessions/${session.id}`}
                      className="font-medium hover:underline"
                    >
                      {session.sellerEmail}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {format.dateTime(session.openedAt, { timeStyle: "short" })}
                      {session.closedAt &&
                        ` – ${format.dateTime(session.closedAt, { timeStyle: "short" })}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <SessionStatusBadge status={session.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">{money(session.totals.salesTotal)}</TableCell>
                  <TableCell className="tabular-nums">{money(session.totals.expectedCash)}</TableCell>
                  <TableCell className="tabular-nums">
                    {session.countedCash === null ? "—" : money(session.countedCash)}
                  </TableCell>
                  <TableCell>
                    <CashDifference value={session.cashDifference} format={money} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>{closure ? t("dayClosedTitle") : t("dayPreviewTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {closure ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("dayClosedBy", {
                      email: closure.closedByEmail,
                      date: format.dateTime(closure.closedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </p>
                  <DaySummary
                    rows={closure.breakdown.map((row) => ({
                      label:
                        row.method === "cash"
                          ? t("methodCash")
                          : row.method === "wallet"
                            ? (row.provider ?? t("methodWallet"))
                            : t("methodOther"),
                      value: `${money(row.total)} (${row.count})`,
                    }))}
                    totals={[
                      { label: t("salesTotal"), value: money(closure.salesTotal) },
                      { label: t("expectedCash"), value: money(closure.expectedCash) },
                      { label: t("countedCash"), value: money(closure.countedCash) },
                    ]}
                    difference={<CashDifference value={closure.cashDifference} format={money} />}
                    differenceLabel={t("difference")}
                  />
                </>
              ) : (
                <>
                  <SessionTotalsView totals={day.consolidated} />
                  {day.openCount > 0 && (
                    <StatusAlert variant="warning">
                      {t("openSessionsHint", { count: day.openCount })}
                    </StatusAlert>
                  )}
                  <CloseDayButton date={date} disabled={day.openCount > 0} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {closures.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{t("recentClosures")}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("day")}</TableHead>
                <TableHead>{t("sessionCount")}</TableHead>
                <TableHead>{t("salesTotal")}</TableHead>
                <TableHead>{t("difference")}</TableHead>
                <TableHead>{t("closedBy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/admin/cash-closures?date=${formatBusinessDate(row.businessDate)}`}
                      className="font-medium hover:underline"
                    >
                      {format.dateTime(row.businessDate, { dateStyle: "medium", timeZone: "UTC" })}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.sessionCount}</TableCell>
                  <TableCell className="tabular-nums">{money(row.salesTotal)}</TableCell>
                  <TableCell>
                    <CashDifference value={row.cashDifference} format={money} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.closedByEmail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DaySummary({
  rows,
  totals,
  difference,
  differenceLabel,
}: {
  rows: { label: string; value: string }[];
  totals: { label: string; value: string }[];
  difference: React.ReactNode;
  differenceLabel: string;
}) {
  return (
    <dl className="flex flex-col gap-1 text-sm tabular-nums">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-2">
          <dt>{row.label}</dt>
          <dd dir="ltr">{row.value}</dd>
        </div>
      ))}
      <div className="my-1 border-t border-dashed" />
      {totals.map((row) => (
        <div key={row.label} className="flex justify-between gap-2 font-semibold">
          <dt>{row.label}</dt>
          <dd dir="ltr">{row.value}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-2 font-semibold">
        <dt>{differenceLabel}</dt>
        <dd>{difference}</dd>
      </div>
    </dl>
  );
}
