import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { z } from "zod";
import { EmptyState } from "~/components/ui/empty-state";
import { DeliveryLabels } from "~/features/orders/delivery-labels";
import { orderLabelsQuery } from "~/features/orders/orders.queries";

// The labels of the orders ticked in the list, one per printed page.
export const Route = createFileRoute("/$locale/admin/_dashboard/orders/labels")({
  validateSearch: z.object({ ids: z.array(z.string().min(1)).max(100).catch([]).default([]) }),
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    deps.ids.length > 0 ? queryClient.ensureQueryData(orderLabelsQuery(deps.ids)) : null,
  staticData: { section: "admin.nav.salesGroup", title: "orders.labelsTitle" },
  component: LabelsPage,
});

function LabelsPage() {
  const t = useTranslations("orders");
  const { ids } = Route.useSearch();
  if (ids.length === 0) return <EmptyState icon="orders" title={t("labelsCount", { count: 0 })} />;
  return <Labels ids={ids} />;
}

function Labels({ ids }: { ids: string[] }) {
  const { data } = useSuspenseQuery(orderLabelsQuery(ids));
  return <DeliveryLabels data={data} />;
}
