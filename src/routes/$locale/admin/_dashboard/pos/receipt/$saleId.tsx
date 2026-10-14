import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { Button, ButtonLink } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { receiptQuery } from "~/features/pos/pos.queries";
import { SaleReceipt } from "~/features/pos/sale-receipt";

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/receipt/$saleId")({
  loader: async ({ context: { queryClient }, params }) => {
    if (!(await queryClient.ensureQueryData(receiptQuery(params.saleId)))) throw notFound();
  },
  staticData: { section: "admin.nav.salesGroup", title: "pos.receipt" },
  component: ReceiptPage,
});

function ReceiptPage() {
  const t = useTranslations("pos");
  const { locale } = Route.useRouteContext();
  const { saleId } = Route.useParams();
  const { data } = useSuspenseQuery(receiptQuery(saleId));
  if (!data) return null;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-7 pb-14 print:max-w-full print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <ButtonLink variant="quiet" to="/$locale/admin/pos" params={{ locale }}>
          <Icon name="chevronLeft" />
          {t("backToCheckout")}
        </ButtonLink>
        <Button onClick={() => window.print()}>
          <Icon name="print" />
          {t("printReceipt")}
        </Button>
      </div>
      <h1 className="sr-only">{t("receipt")}</h1>
      <SaleReceipt receipt={data} />
    </div>
  );
}
