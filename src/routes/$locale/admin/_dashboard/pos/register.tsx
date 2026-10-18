import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFormatter, useTranslations } from "next-intl";
import { adminPageBoundaries } from "@/components/errors/admin-boundaries";
import { ArrowLeft, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/auth/scope";
import { getOpenSession, getSessionView } from "@/lib/queries/cash-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRegisterForm } from "@/components/cash/open-register-form";
import { SessionTotalsView } from "@/components/cash/session-totals";
import { CashMovementForm } from "@/components/cash/cash-movement-form";
import { CloseSessionForm } from "@/components/cash/close-session-form";
import { MovementList } from "@/components/cash/movement-list";

// Ex-app/[locale]/admin/(dashboard)/pos/register/page.tsx.

// The caller's own open till: live figures, cash in/out, and closing.

const loadRegisterPage = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, productType } = await requireCheckoutViewScope();
  const open = await getOpenSession(admin.id, productType);
  // Pas de caisse ouverte : la page affiche le formulaire d'ouverture.
  if (!open) {
    return { session: null } as const;
  }

  const session = await getSessionView(open.id, productType, admin);
  if (!session) {
    return { session: null } as const;
  }

  return { session };
});

export const Route = createFileRoute("/$locale/admin/_dashboard/pos/register")({
  loader: () => loadRegisterPage(),
  component: RegisterPage,
  ...adminPageBoundaries,
});

function RegisterPage() {
  const { session } = Route.useLoaderData();
  const t = useTranslations("cash");
  const format = useFormatter();

  if (!session) {
    return <OpenRegisterForm />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("openedAt", {
              date: format.dateTime(session.openedAt, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link href="/admin/pos">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t("backToCheckout")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/pos/sessions">
              <ClockCounterClockwise className="size-4" />
              {t("sessionsTitle")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionTotalsView totals={session.totals} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("movementsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CashMovementForm />
              <MovementList movements={session.movements} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("closeTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CloseSessionForm
                sessionId={session.id}
                expectedCash={session.totals.expectedCash}
                redirectTo={`/admin/pos/sessions/${session.id}`}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
