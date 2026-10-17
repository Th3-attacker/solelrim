import { useCallback } from "react";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { MySales } from "~/features/sales/my-sales";
import { mySalesSearchSchema } from "~/features/sales/sales.functions";
import { mySalesQuery } from "~/features/sales/sales.queries";

// La liste en lecture seule de ses propres ventes (un vendeur, ou un admin
// qui encaisse). Les filtres sont dans l'adresse : une vue se partage et
// survit au rechargement.
export const Route = createFileRoute("/$locale/admin/_dashboard/pos/my-sales")({
  validateSearch: mySalesSearchSchema,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(mySalesQuery(deps)),
  staticData: { section: "admin.nav.salesGroup", title: "nav.mySales" },
  component: MySalesPage,
});

function MySalesPage() {
  const { locale } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // Un filtre change : la liste revient à la première page.
  const onSearch = useCallback(
    (filters: Partial<typeof search>) =>
      navigate({ search: (prev) => ({ ...prev, ...filters }), resetScroll: false }),
    [navigate],
  );

  return <MySales locale={locale} search={search} onSearch={onSearch} />;
}
