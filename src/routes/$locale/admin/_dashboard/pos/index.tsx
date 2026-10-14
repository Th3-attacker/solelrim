import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ButtonLink } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { Checkout } from "~/features/pos/checkout";
import { checkoutQuery } from "~/features/pos/pos.queries";
import { OpenTill, useMoney } from "~/features/pos/till-parts";

// The checkout. No till open, no checkout: the caller opens theirs first
// (the server refuses a sale without one anyway).
export const Route = createFileRoute("/$locale/admin/_dashboard/pos/")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(checkoutQuery),
  staticData: { section: "admin.nav.salesGroup", title: "nav.pos" },
  component: PosPage,
});

function PosPage() {
  const t = useTranslations("pos");
  const tCash = useTranslations("cash");
  const format = useFormatter();
  const money = useMoney();
  const { locale } = Route.useRouteContext();
  const { data } = useSuspenseQuery(checkoutQuery);

  if (!data.open) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 md:py-12">
        <OpenTill lastClosed={data.lastClosed} />
        <ButtonLink variant="quiet" to="/$locale/admin/pos/sessions" params={{ locale }}>
          {tCash("previousSessions")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-6">
        <h1 className="text-[16px] font-bold">{t("title")}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-1 text-[12px] font-semibold text-ok-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {tCash("openBadge", {
            amount: money(data.session.openingFloat),
            time: format.dateTime(data.session.openedAt, { hour: "2-digit", minute: "2-digit" }),
          })}
        </span>
        <span className="flex-1" />
        <ButtonLink size="sm" to="/$locale/admin/pos/register" params={{ locale }}>
          <Icon name="lock" className="size-4" />
          {tCash("registerTitle")}
        </ButtonLink>
      </div>
      <Checkout data={data} locale={locale} />
    </div>
  );
}
