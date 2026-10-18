import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ClientsSkeleton } from "@/components/dashboard/page-skeletons";
import { pageInput } from "@/src/server/validators";
import { Plus, Users, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { getClientsPage, CLIENTS_PAGE_SIZE } from "@/lib/queries/clients";
import { getAdminScope } from "@/lib/auth/scope";
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
import { SectionTabs } from "@/components/dashboard/section-tabs";

// Ex-app/[locale]/admin/(dashboard)/clients/page.tsx.

const loadAdminClientsPage = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const params = data.search;
    const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
    const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

    const scope = await getAdminScope();
    const { clients, total } = await getClientsPage(scope, { search, page });

    // Les tailles de page viennent du serveur : leurs modules (lib/queries)
    // importent Prisma et n'ont rien à faire dans le navigateur.
    return { search, page, clients, total, clientsPageSize: CLIENTS_PAGE_SIZE };
  });

export const Route = createFileRoute("/$locale/admin/_dashboard/clients/")({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => loadAdminClientsPage({ data: { search: deps.search } }),
  component: AdminClientsPage,
  ...adminPageBoundaries,
  pendingComponent: ClientsSkeleton,
});

function AdminClientsPage() {
  const { search, page, clients, total, clientsPageSize } = Route.useLoaderData();
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs group="clients" current="/admin/clients" />
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
        <StateMessage
          icon={search ? MagnifyingGlass : Users}
          title={search ? tCommon("noResults") : t("noClients")}
        />
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
                <TableCell className="text-muted-foreground">{client.phone}</TableCell>
                <TableCell className="text-muted-foreground">{client.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        page={page}
        pageSize={clientsPageSize}
        total={total}
        basePath="/admin/clients"
        searchParams={{ q: search }}
      />
    </div>
  );
}
