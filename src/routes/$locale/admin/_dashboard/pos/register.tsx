import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import { PageHeader } from "~/components/ui/page-header";
import { myTillQuery } from "~/features/pos/pos.queries";
import { CloseTillForm, MovementForm, OpenTill, TillTotals } from "~/features/pos/till-parts";
import { MovementList } from "~/features/pos/till-views";

// The caller's own open till: its live figures, cash in and out, closing.
export const Route = createFileRoute("/$locale/admin/_dashboard/pos/register")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(myTillQuery),
  staticData: { section: "admin.nav.salesGroup", title: "cash.registerTitle" },
  component: RegisterPage,
});

function RegisterPage() {
  const t = useTranslations("cash");
  const format = useFormatter();
  const navigate = useNavigate();
  const { locale } = Route.useRouteContext();
  const { data: session } = useSuspenseQuery(myTillQuery);

  if (!session) {
    return (
      <div className="px-4 py-10">
        <OpenTill lastClosed={null} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
      <PageHeader
        title={t("registerTitle")}
        description={t("openedAt", {
          date: format.dateTime(session.openedAt, { dateStyle: "medium", timeStyle: "short" }),
        })}
        actions={
          <ButtonLink to="/$locale/admin/pos" params={{ locale }}>
            <Icon name="chevronLeft" />
            {t("backToCheckout")}
          </ButtonLink>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card as="section" aria-labelledby="till-summary" className="p-5">
          <h2 id="till-summary" className="mb-3 text-card-title">
            {t("summary")}
          </h2>
          <TillTotals totals={session.totals} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card as="section" aria-labelledby="till-movements" className="flex flex-col gap-4 p-5">
            <h2 id="till-movements" className="text-card-title">
              {t("movementsTitle")}
            </h2>
            <MovementForm />
            <MovementList movements={session.movements} />
          </Card>
          <Card as="section" aria-labelledby="till-close" className="p-5">
            <h2 id="till-close" className="mb-3 text-card-title">
              {t("closeTitle")}
            </h2>
            <CloseTillForm
              sessionId={session.id}
              expectedCash={session.totals.expectedCash}
              onClosed={() =>
                void navigate({
                  to: "/$locale/admin/pos/sessions/$sessionId",
                  params: { locale, sessionId: session.id },
                })
              }
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
