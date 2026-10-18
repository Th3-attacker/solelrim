import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFormatter, useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { pageInput } from "@/src/server/validators";
import { ArrowLeft, CashRegister } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/auth/scope";
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
import { SectionTabs } from "@/components/dashboard/section-tabs";

// Ex-app/[locale]/admin/(dashboard)/pos/sessions/page.tsx.

// A seller sees their own tills; an admin every till of the boutique.

const loadSessionsPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const { page: pageParam } = data.search;
    const page = Number(pageParam) || 1;
    const { admin, productType } = await requireCheckoutViewScope();
    const { sessions, total } = await listSessions(productType, admin, page);
    const showSeller = admin.role !== "SELLER";

    // Les tailles de page viennent du serveur : leurs modules (lib/queries)
    // importent Prisma et n'ont rien à faire dans le navigateur.
    return { page, sessions, total, showSeller, sessionsPageSize: SESSIONS_PAGE_SIZE };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/sessions/")({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => loadSessionsPage({ data: { search: deps.search } }),
  component: SessionsPage,
  ...adminPageBoundaries,
});

function SessionsPage() {
  const { page, sessions, total, showSeller, sessionsPageSize } = Route.useLoaderData();
  const t = useTranslations("cash");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const money = (amount: number) => formatPrice(amount, tCommon("currency"));

  return (
    <div className="flex flex-col gap-6">
      {showSeller && <SectionTabs group="cash" current="/admin/pos/sessions" />}
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
        pageSize={sessionsPageSize}
        total={total}
        basePath="/admin/pos/sessions"
        searchParams={{}}
      />
    </div>
  );
}
