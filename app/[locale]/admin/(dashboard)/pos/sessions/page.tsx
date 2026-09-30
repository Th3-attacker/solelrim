import { ArrowLeft, CashRegister } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/shop/admin-scope";
import { listSessions, SESSIONS_PAGE_SIZE } from "@/lib/queries/cash-sessions";
import { formatPrice } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/list-pagination";
import { StateMessage } from "@/components/ui/state-message";
import { SessionStatusBadge } from "@/components/cash/session-status-badge";
import { CashDifference } from "@/components/cash/cash-difference";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// A seller sees their own tills; an admin every till of the boutique.
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const { admin, productType } = await requireCheckoutViewScope();
  const [{ sessions, total }, t, tCommon, format] = await Promise.all([
    listSessions(productType, admin, page),
    getTranslations("cash"),
    getTranslations("common"),
    getFormatter(),
  ]);
  const money = (amount: number) => formatPrice(amount, tCommon("currency"));
  const showSeller = admin.role !== "SELLER";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("sessionsTitle")}</h1>
        <Button asChild variant="ghost">
          <Link href="/admin/pos">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("backToCheckout")}
          </Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <StateMessage icon={CashRegister} title={t("noSessions")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("openedAtColumn")}</TableHead>
              {showSeller && <TableHead>{t("seller")}</TableHead>}
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("openingFloat")}</TableHead>
              <TableHead>{t("expectedCash")}</TableHead>
              <TableHead>{t("countedCash")}</TableHead>
              <TableHead>{t("difference")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <Link
                    href={`/admin/pos/sessions/${session.id}`}
                    className="font-medium whitespace-nowrap hover:underline"
                  >
                    {format.dateTime(session.openedAt, { dateStyle: "medium", timeStyle: "short" })}
                  </Link>
                </TableCell>
                {showSeller && <TableCell>{session.sellerEmail}</TableCell>}
                <TableCell>
                  <SessionStatusBadge status={session.status} />
                </TableCell>
                <TableCell className="tabular-nums">{money(session.openingFloat)}</TableCell>
                <TableCell className="tabular-nums">
                  {session.expectedCash === null ? "—" : money(session.expectedCash)}
                </TableCell>
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
      )}

      <ListPagination
        page={page}
        pageSize={SESSIONS_PAGE_SIZE}
        total={total}
        basePath="/admin/pos/sessions"
        searchParams={{}}
      />
    </div>
  );
}
