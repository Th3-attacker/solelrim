import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAllSales } from "@/lib/queries/sales";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminSalesPage() {
  const [t, sales] = await Promise.all([
    getTranslations("sales"),
    getAllSales(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/sales/new">
            <Plus className="size-4" />
            {t("newSale")}
          </Link>
        </Button>
      </div>

      {sales.length === 0 ? (
        <p className="text-muted-foreground">{t("noSales")}</p>
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
                <TableCell>{sale.total.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge
                    variant={sale.status === "COMPLETED" ? "secondary" : "destructive"}
                  >
                    {sale.status === "COMPLETED" ? t("completed") : t("cancelled")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {sale.createdAt.toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
