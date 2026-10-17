import { Outlet, createFileRoute } from "@tanstack/react-router";
import { guardSignedInAdmin } from "~/features/auth/guard";
import { shellQuery } from "~/features/shell/shell.queries";
import { AppShell } from "~/components/layout/app-shell";

// Every page behind the login, inside the admin's frame.
export const Route = createFileRoute("/$locale/admin/_dashboard")({
  beforeLoad: ({ context, location }) =>
    guardSignedInAdmin({ queryClient: context.queryClient, locale: context.locale, location }),
  loader: ({ context }) => context.queryClient.ensureQueryData(shellQuery),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { locale } = Route.useRouteContext();
  return (
    <AppShell locale={locale}>
      <Outlet />
    </AppShell>
  );
}
