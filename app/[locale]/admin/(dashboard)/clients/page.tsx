import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAllClients } from "@/lib/queries/clients";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminClientsPage() {
  const [t, clients] = await Promise.all([
    getTranslations("clients"),
    getAllClients(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/clients/new">
            <Plus className="size-4" />
            {t("newClient")}
          </Link>
        </Button>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground">{t("noClients")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("email")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="font-medium hover:underline"
                  >
                    {client.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.phone}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.email}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
