import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClientById } from "@/lib/queries/clients";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { ClientForm } from "@/components/clients/client-form";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const scope = await getAdminScope();
  const [t, tSales, tCommon, client] = await Promise.all([
    getTranslations("clients"),
    getTranslations("sales"),
    getTranslations("common"),
    getClientById(clientId, scope),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.fullName}
        </h1>
        <DeleteClientButton clientId={client.id} />
      </div>

      <ClientForm
        clientId={client.id}
        defaultValues={{
          fullName: client.fullName,
          phone: client.phone ?? "",
          email: client.email ?? "",
          address: client.address ?? "",
          notes: client.notes ?? "",
        }}
      />

      <div>
        <h2 className="mb-2 text-sm font-medium">{t("purchaseHistory")}</h2>
        {client.sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tSales("noSales")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tSales("reference")}</TableHead>
                <TableHead>{tSales("date")}</TableHead>
                <TableHead>{tSales("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.sales.map((sale) => (
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
                    {sale.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>{formatPrice(sale.total, tCommon("currency"))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
