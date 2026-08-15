import { getTranslations } from "next-intl/server";
import { Plus, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getClientsPage, CLIENTS_PAGE_SIZE } from "@/lib/queries/clients";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { ListPagination } from "@/components/ui/list-pagination";
import { ClientFilters } from "@/components/clients/client-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const scope = await getAdminScope();
  const [t, tCommon, { clients, total }] = await Promise.all([
    getTranslations("clients"),
    getTranslations("common"),
    getClientsPage(scope, { search, page }),
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

      <ClientFilters />

      {clients.length === 0 ? (
        <StateMessage icon={Users} title={search ? tCommon("noResults") : t("noClients")} />
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

      <ListPagination
        page={page}
        pageSize={CLIENTS_PAGE_SIZE}
        total={total}
        basePath="/admin/clients"
        searchParams={{ q: search }}
      />
    </div>
  );
}
