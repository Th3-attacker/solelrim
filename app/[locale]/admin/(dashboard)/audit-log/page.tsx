import { getTranslations, getFormatter } from "next-intl/server";
import { ClockCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { getAuditLog, AUDIT_LOG_PAGE_SIZE } from "@/lib/queries/audit";
import { AUDIT_ACTION_LABEL_KEY } from "@/lib/audit-actions";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { requireSuperAdminPage } from "@/lib/auth/admin";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import { AuditLogFilters } from "@/components/audit-log/audit-log-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSuperAdminPage();

  const params = await searchParams;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const action =
    typeof params.action === "string" && AUDIT_ACTION_LABEL_KEY[params.action]
      ? params.action
      : undefined;
  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;
  const from = parseDateParam(fromParam);
  const to = parseDateParam(toParam);
  const dateFrom = from ? startOfDay(from) : undefined;
  const dateTo = to ? endOfDay(to) : undefined;
  const hasFilters = Boolean(search || action || dateFrom || dateTo);

  const scope = await getAdminScope();
  const [t, tCommon, format, { entries, total }] = await Promise.all([
    getTranslations("auditLog"),
    getTranslations("common"),
    getFormatter(),
    getAuditLog(scope, { page, search, action, dateFrom, dateTo }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AuditLogFilters />

      {entries.length === 0 ? (
        <StateMessage
          icon={hasFilters ? MagnifyingGlass : ClockCounterClockwise}
          title={hasFilters ? tCommon("noResults") : t("noEntries")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("admin")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("target")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground">
                  {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </TableCell>
                <TableCell>{entry.adminEmail}</TableCell>
                <TableCell>
                  {AUDIT_ACTION_LABEL_KEY[entry.action]
                    ? t(AUDIT_ACTION_LABEL_KEY[entry.action])
                    : entry.action}
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.targetLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        page={page}
        pageSize={AUDIT_LOG_PAGE_SIZE}
        total={total}
        basePath="/admin/audit-log"
        searchParams={{ q: search, action, from: fromParam, to: toParam }}
      />
    </div>
  );
}
