import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { LogoutButton } from "~/features/auth/logout-button";

// Step 0: proves the chain (session, guard, server functions) end to end.
// The dashboard of the design replaces this page in step 2.
export const Route = createFileRoute("/$locale/admin/_dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const t = useTranslations();
  const { admin, locale } = Route.useRouteContext();

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-7 md:px-8">
      <h1 className="text-page-title">{t("nav.dashboard")}</h1>
      <p className="text-ink-2">
        {admin.email} · {t(`auditLog.role.${admin.role}`)}
      </p>
      <div>
        <LogoutButton locale={locale} />
      </div>
    </main>
  );
}
