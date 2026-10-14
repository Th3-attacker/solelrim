import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DeliveryLabels } from "~/features/orders/delivery-labels";
import { orderLabelsQuery } from "~/features/orders/orders.queries";

// One order's label, from its page.
export const Route = createFileRoute("/$locale/admin/_dashboard/orders/$orderId/label")({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(orderLabelsQuery([params.orderId])),
  staticData: { section: "admin.nav.salesGroup", title: "orders.labelsTitle" },
  component: LabelPage,
});

function LabelPage() {
  const { orderId } = Route.useParams();
  const { data } = useSuspenseQuery(orderLabelsQuery([orderId]));
  return <DeliveryLabels data={data} />;
}
