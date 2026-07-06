import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSaleById } from "@/lib/queries/sales";
import { Badge } from "@/components/ui/badge";
import { PrintInvoiceButton } from "@/components/sales/print-invoice-button";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const [t, tProducts, sale] = await Promise.all([
    getTranslations("sales"),
    getTranslations("products"),
    getSaleById(saleId),
  ]);

  if (!sale) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {sale.reference}
          </h1>
          <Badge variant={sale.status === "COMPLETED" ? "secondary" : "destructive"}>
            {sale.status === "COMPLETED" ? t("completed") : t("cancelled")}
          </Badge>
        </div>
        <div className="flex gap-2">
          <PrintInvoiceButton />
          {sale.status === "COMPLETED" && <CancelSaleButton saleId={sale.id} />}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Solelrim</p>
            <p className="text-sm text-muted-foreground">{t("invoiceTitle")}</p>
          </div>
          <div className="text-end text-sm">
            <p className="font-medium">{sale.reference}</p>
            <p className="text-muted-foreground">
              {sale.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm">
          {t("client")}: {sale.client?.fullName ?? t("walkInClient")}
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tProducts("name")}</TableHead>
              <TableHead>{tProducts("size")}</TableHead>
              <TableHead>{tProducts("color")}</TableHead>
              <TableHead>{t("quantity")}</TableHead>
              <TableHead>{t("unitPrice")}</TableHead>
              <TableHead>{t("lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.variant.product.name}</TableCell>
                <TableCell>{item.variant.size}</TableCell>
                <TableCell>{item.variant.color}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.unitPrice.toFixed(2)}</TableCell>
                <TableCell>{item.lineTotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <p>
            {t("subtotal")}: {sale.subtotal.toFixed(2)}
          </p>
          <p>
            {t("discount")}: {sale.discount.toFixed(2)}
          </p>
          <p className="text-base font-semibold">
            {t("total")}: {sale.total.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
