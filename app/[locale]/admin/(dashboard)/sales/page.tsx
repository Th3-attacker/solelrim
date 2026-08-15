
import { getTranslations, getFormatter } from "next-intl/server";

import { Plus, Receipt } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getAllSales } from "@/lib/queries/sales";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateMessage } from "@/components/ui/state-message";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminSalesPage() {
  const scope = await getAdminScope();
  const [t, tCommon, format, sales] = await Promise.all([
    getTranslations("sales"),
    getTranslations("common"),
    getFormatter(),
    getAllSales(scope),
  ]);

  const csvColumns = [
    { key: "reference", label: t("reference") },
    { key: "client", label: t("client") },
    { key: "total", label: t("total") },
    { key: "status", label: t("status") },
    { key: "date", label: t("date") },
  ];
  const csvRows = sales.map((sale) => ({
    reference: sale.reference,
    client: sale.client?.fullName ?? t("walkInClient"),
    total: formatPrice(sale.total, tCommon("currency")),
    status: sale.status === "COMPLETED" ? t("completed") : t("cancelled"),
    date: format.dateTime(sale.createdAt, { dateStyle: "medium" }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            label={tCommon("exportCsv")}
            filename={`sales-${new Date().toISOString().slice(0, 10)}.csv`}
            columns={csvColumns}
            rows={csvRows}
          />
          <Button asChild>
            <Link href="/admin/sales/new">
              <Plus className="size-4" />
              {t("newSale")}
            </Link>
          </Button>
        </div>
      </div>

      {sales.length === 0 ? (
        <StateMessage icon={Receipt} title={t("noSales")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reference")}</TableHead>
              <TableHead>{t("client")}</TableHead>
              <TableHead>{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>
                  <Link
                    href={`/admin/sales/${sale.id}`}
                    className="font-medium hover:underline"
                  >
                    {sale.reference}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {sale.client?.fullName ?? t("walkInClient")}
                </TableCell>
                <TableCell>{formatPrice(sale.total, tCommon("currency"))}</TableCell>
                <TableCell>
                  <Badge
                    variant={sale.status === "COMPLETED" ? "secondary" : "destructive"}
                  >
                    {sale.status === "COMPLETED" ? t("completed") : t("cancelled")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format.dateTime(sale.createdAt, { dateStyle: "medium" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
