import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { ClockCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { getAuditLog, getAuditLogActors, AUDIT_LOG_PAGE_SIZE } from "@/lib/queries/audit";
import { getStoreTypes } from "@/lib/queries/settings";
import { AUDIT_ACTION_LABEL_KEY, isAuditAction } from "@/lib/audit-actions";
import { auditChangeRows } from "@/lib/shop/audit-diff";
import { requireAuditLogScope } from "@/lib/shop/admin-scope";
import type { JsonValue } from "@/lib/generated/prisma/internal/prismaNamespace";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import { Badge } from "@/components/ui/badge";
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

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// A boutique admin sees their own boutique's entries, a superadmin every
// boutique's (optionally narrowed to one), a seller gets a 404.
export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const scope = await requireAuditLogScope().catch(() => notFound());
  const isSuperAdmin = scope.productType === null;

  const params = await searchParams;
  const page = Number(stringParam(params.page)) || 1;
  const search = stringParam(params.q);
  const actionParam = stringParam(params.action);
  const action = actionParam && isAuditAction(actionParam) ? actionParam : undefined;
  const adminUserId = stringParam(params.user);
  const fromParam = stringParam(params.from);
  const toParam = stringParam(params.to);
  const from = parseDateParam(fromParam);
  const to = parseDateParam(toParam);
  const dateFrom = from ? startOfDay(from) : undefined;
  const dateTo = to ? endOfDay(to) : undefined;

  const storeTypes = isSuperAdmin ? await getStoreTypes() : [];
  const boutiqueParam = stringParam(params.boutique);
  // Only a superadmin can narrow by boutique, and only to a real one; a
  // boutique admin's productType never comes from the URL.
  const boutique =
    isSuperAdmin && boutiqueParam && storeTypes.some((s) => s.key === boutiqueParam)
      ? boutiqueParam
      : undefined;
  const productType = scope.productType ?? boutique ?? null;
  const hasFilters = Boolean(search || action || adminUserId || dateFrom || dateTo || boutique);

  const [t, tCommon, format, { entries, total }, actors] = await Promise.all([
    getTranslations("auditLog"),
    getTranslations("common"),
    getFormatter(),
    getAuditLog(productType, { page, search, action, adminUserId, dateFrom, dateTo }),
    getAuditLogActors(productType),
  ]);
  const boutiqueLabel = new Map(storeTypes.map((s) => [s.key, s.label]));

  function formatValue(value: JsonValue | undefined): string {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "boolean") return value ? t("valueYes") : t("valueNo");
    if (typeof value === "number") return format.number(value);
    if (typeof value === "string") {
      return t.has(`value.${value}`) ? t(`value.${value}`) : value;
    }
    return JSON.stringify(value);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AuditLogFilters
        actors={actors}
        boutiques={
          isSuperAdmin ? storeTypes.map((s) => ({ key: s.key, label: s.label })) : undefined
        }
      />

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
              <TableHead>{t("details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const changes = auditChangeRows(entry.oldValue, entry.newValue);
              return (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span>{entry.adminEmail}</span>
                      {entry.adminRole && (
                        <Badge variant="secondary">{t(`role.${entry.adminRole}`)}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isAuditAction(entry.action)
                      ? t(AUDIT_ACTION_LABEL_KEY[entry.action])
                      : entry.action}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{entry.targetLabel}</span>
                      {isSuperAdmin && (
                        <span className="text-xs text-muted-foreground">
                          {boutiqueLabel.get(entry.productType) ?? entry.productType}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-56 text-xs">
                    {changes.length > 0 && (
                      <dl className="flex flex-col gap-0.5">
                        {changes.map((change) => (
                          <div key={change.field} className="flex flex-wrap gap-x-1">
                            <dt className="text-muted-foreground">
                              {t.has(`field.${change.field}`)
                                ? t(`field.${change.field}`)
                                : change.field}
                              :
                            </dt>
                            <dd>
                              {"before" in change && (
                                <>
                                  <span className="text-muted-foreground line-through">
                                    {formatValue(change.before)}
                                  </span>{" "}
                                  <span aria-hidden="true" className="rtl:rotate-180 inline-block">
                                    →
                                  </span>{" "}
                                </>
                              )}
                              {"after" in change ? formatValue(change.after) : "—"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {entry.reason && (
                      <p className="mt-1">
                        <span className="text-muted-foreground">{t("reason")}:</span>{" "}
                        {entry.reason}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ListPagination
        page={page}
        pageSize={AUDIT_LOG_PAGE_SIZE}
        total={total}
        basePath="/admin/audit-log"
        searchParams={{
          q: search,
          action,
          user: adminUserId,
          boutique,
          from: fromParam,
          to: toParam,
        }}
      />
    </div>
  );
}
