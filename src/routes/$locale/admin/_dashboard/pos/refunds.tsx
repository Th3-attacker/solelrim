import { useCallback } from "react";
import { Link, createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { z } from "zod";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { RefundsPanel } from "~/features/sales/refunds-panel";
import { REFUND_FILTERS } from "~/features/sales/sales.functions";
import { refundsQuery } from "~/features/sales/sales.queries";

// Les demandes de remboursement vivent sous la caisse : c'est la seule
// adresse que le vendeur a le droit d'ouvrir (admin-access.ts). Un admin
// les décide aussi depuis l'onglet de Ventes — le même panneau des deux
// côtés.
export const Route = createFileRoute("/$locale/admin/_dashboard/pos/refunds")({
  validateSearch: z.object({
    status: z.enum(REFUND_FILTERS).catch("PENDING").default("PENDING"),
    page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  }),
  search: { middlewares: [stripSearchParams({ status: "PENDING", page: 1 })] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(refundsQuery(deps.status, deps.page)),
  staticData: { section: "admin.nav.salesGroup", title: "nav.refunds" },
  component: RefundsPage,
});

function RefundsPage() {
  const t = useTranslations("refunds");
  const { locale } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onStatusChange = useCallback(
    (status: (typeof REFUND_FILTERS)[number]) =>
      void navigate({ search: (prev) => ({ ...prev, status, page: 1 }), resetScroll: false }),
    [navigate],
  );
  const onPageChange = useCallback(
    (page: number) => void navigate({ search: (prev) => ({ ...prev, page }), resetScroll: false }),
    [navigate],
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      {/* L'indice (admin ou vendeur) est déjà dans le panneau. */}
      <PageHeader title={t("title")} />
      <Card as="section" aria-label={t("title")} className="overflow-hidden">
        <RefundsPanel
          status={search.status}
          page={search.page}
          onStatusChange={onStatusChange}
          onPageChange={onPageChange}
          renderSaleLink={(request) => (
            <Link
              to="/$locale/admin/pos/receipt/$saleId"
              params={{ locale, saleId: request.saleId }}
              className="text-[13px] font-semibold text-ink no-underline hover:text-brand hover:underline"
            >
              {request.saleReference}
            </Link>
          )}
        />
      </Card>
    </div>
  );
}
