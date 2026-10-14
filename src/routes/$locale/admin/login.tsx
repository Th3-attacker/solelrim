import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/features/auth/login-form";
import { guardAdminPage } from "~/features/auth/guard";

export const Route = createFileRoute("/$locale/admin/login")({
  // Already signed in: straight to the admin.
  beforeLoad: async ({ context, location }) => {
    await guardAdminPage({ queryClient: context.queryClient, locale: context.locale, location });
  },
  component: LoginPage,
});

function LoginPage() {
  const { locale } = Route.useRouteContext();
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <LoginForm locale={locale} />
    </main>
  );
}
