import { ArrowLeft, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCheckoutViewScope } from "@/lib/shop/admin-scope";
import { getOpenSession, getSessionView } from "@/lib/queries/cash-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRegisterForm } from "@/components/cash/open-register-form";
import { SessionTotalsView } from "@/components/cash/session-totals";
import { CashMovementForm } from "@/components/cash/cash-movement-form";
import { CloseSessionForm } from "@/components/cash/close-session-form";
import { MovementList } from "@/components/cash/movement-list";

// The caller's own open till: live figures, cash in/out, and closing.
export default async function RegisterPage() {
  const { admin, productType } = await requireCheckoutViewScope();
  const open = await getOpenSession(admin.id, productType);
  if (!open) {
    return <OpenRegisterForm />;
  }

  const [session, t, format] = await Promise.all([
    getSessionView(open.id, productType, admin),
    getTranslations("cash"),
    getFormatter(),
  ]);
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
