import { getTranslations, getFormatter } from "next-intl/server";
import { History } from "lucide-react";
import { getAuditLog, AUDIT_LOG_PAGE_SIZE } from "@/lib/queries/audit";
import { AUDIT_ACTION_LABEL_KEY } from "@/lib/audit-actions";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const scope = await getAdminScope();
  const [t, format, { entries, total }] = await Promise.all([
    getTranslations("auditLog"),
    getFormatter(),
    getAuditLog(scope, { page }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {entries.length === 0 ? (
        <StateMessage icon={History} title={t("noEntries")} />
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
        searchParams={{}}
      />
    </div>
  );
}
