import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/shop/admin-scope";
import { getSessionView } from "@/lib/queries/cash-sessions";
import { formatPrice } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionTotalsView } from "@/components/cash/session-totals";
import { SessionStatusBadge } from "@/components/cash/session-status-badge";
import { CashDifference } from "@/components/cash/cash-difference";
import { CloseSessionForm } from "@/components/cash/close-session-form";
import { MovementList } from "@/components/cash/movement-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One till, read-only once closed. getSessionView scopes it to the caller's
// boutique and, for a seller, to their own tills — anything else is a 404.
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { admin, productType } = await requireCheckoutViewScope();
  const [session, t, tPos, tCommon, format] = await Promise.all([
    getSessionView(sessionId, productType, admin),
    getTranslations("cash"),
    getTranslations("pos"),
    getTranslations("common"),
    getFormatter(),
  ]);
  if (!session) {
    notFound();
  }
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));
  // An admin may close a till a seller left open; the seller closes their
  // own from the register page.
  const canClose = session.status === "OPEN" && admin.role !== "SELLER";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{session.sellerEmail}</h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("openedAt", {
              date: format.dateTime(session.openedAt, { dateStyle: "medium", timeStyle: "short" }),
            })}
            {session.closedAt &&
              ` · ${t("closedAt", {
                date: format.dateTime(session.closedAt, { dateStyle: "medium", timeStyle: "short" }),
              })}`}
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/admin/pos/sessions">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("sessionsTitle")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SessionTotalsView totals={session.totals} />
            {session.status === "CLOSED" && (
              <dl className="flex flex-col gap-1 border-t pt-3 text-sm tabular-nums">
                <div className="flex justify-between gap-2">
                  <dt>{t("countedCash")}</dt>
                  <dd dir="ltr">{session.countedCash === null ? "—" : money(session.countedCash)}</dd>
                </div>
                <div className="flex justify-between gap-2 font-semibold">
                  <dt>{t("difference")}</dt>
                  <dd>
                    <CashDifference value={session.cashDifference} format={money} />
                  </dd>
                </div>
                {(session.autoClosed || session.closingNote) && (
                  <p className="mt-1 text-muted-foreground">
                    {t("closingNote")}: {session.autoClosed ? t("autoClosedNote") : session.closingNote}
                  </p>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("movementsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MovementList movements={session.movements} />
            </CardContent>
          </Card>

          {canClose && (
            <Card>
              <CardHeader>
                <CardTitle>{t("closeTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CloseSessionForm
                  sessionId={session.id}
                  expectedCash={session.totals.expectedCash}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("salesTitle")}</h2>
        {session.sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSales")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tPos("reference")}</TableHead>
                <TableHead>{t("time")}</TableHead>
                <TableHead>{tPos("paymentMethod")}</TableHead>
                <TableHead>{tPos("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {session.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Link
                      href={`/admin/pos/receipt/${sale.id}`}
                      className="font-medium hover:underline"
                    >
                      {sale.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format.dateTime(sale.createdAt, { timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    {sale.paymentMethod === "wallet"
                      ? (sale.walletProvider ?? tPos("wallet"))
                      : sale.paymentMethod === "cash"
                        ? tPos("cash")
                        : "—"}
                  </TableCell>
                  <TableCell
                    className={
                      sale.status === "CANCELLED"
                        ? "tabular-nums text-muted-foreground line-through"
                        : "tabular-nums"
                    }
                  >
                    {money(sale.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
