import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Pagination } from "~/components/table/data-table";
import { EmptyState } from "~/components/ui/empty-state";
import { Segmented } from "~/components/ui/field";
import { RefundRequestCard } from "./sale-refunds";
import { REFUND_FILTERS, type listRefunds } from "./sales.functions";
import { refundsQuery } from "./sales.queries";

export type RefundStatus = (typeof REFUND_FILTERS)[number];

// Une demande vue par la liste : les champs du panneau d'une vente, plus
// la vente elle-même (identifiant et référence) pour y revenir.
type ListedRequest = NonNullable<Awaited<ReturnType<typeof listRefunds>>>["requests"][number];

// Les demandes de remboursement, identiques dans l'onglet « Ventes » et sur
// la page de la caisse : le filtre de statut, les cartes, la pagination.
// La page autour possède la barre d'adresse et ce qu'ouvre un référence de
// vente (le panneau latéral côté Ventes, le reçu côté caisse).
export function RefundsPanel({
  status,
  page,
  onStatusChange,
  onPageChange,
  renderSaleLink,
}: {
  status: RefundStatus;
  page: number;
  onStatusChange: (status: RefundStatus) => void;
  onPageChange: (page: number) => void;
  renderSaleLink: (request: ListedRequest) => ReactNode;
}) {
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const { data } = useSuspenseQuery(refundsQuery(status, page));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-3">
        <Segmented
          label={t("filterLabel")}
          name="refund-status"
          value={status}
          onChange={onStatusChange}
          options={[
            { value: "PENDING", label: t("status.PENDING") },
            { value: "APPROVED", label: t("status.APPROVED") },
            { value: "REJECTED", label: t("status.REJECTED") },
            { value: "ALL", label: t("all") },
          ]}
        />
        <p className="text-[13px] text-muted">{t(data.canDecide ? "adminHint" : "sellerHint")}</p>
      </div>
      {data.requests.length === 0 ? (
        <EmptyState icon="sales" title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          {data.requests.map((request) => (
            <li key={request.id}>
              <RefundRequestCard
                request={request}
                canDecide={data.canDecide}
                saleLink={renderSaleLink(request)}
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        pageSize={data.pageSize}
        total={data.total}
        rangeLabel={(range) => tCommon("paginationRange", range)}
        previousLabel={tCommon("previous")}
        nextLabel={tCommon("next")}
        onPageChange={onPageChange}
      />
    </>
  );
}
