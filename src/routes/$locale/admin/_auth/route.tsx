import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Storefront } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Ex-app/[locale]/admin/(auth)/layout.tsx.
export const Route = createFileRoute("/$locale/admin/_auth")({
  loader: () => ({ meta: { robots: { index: false, follow: false } } }),
  staleTime: Infinity,
  component: AuthLayout,
});

function AuthLayout() {
  const t = useTranslations("auth.login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <Outlet />
      {/* /admin/login is now reachable from a boutique's own branded
          domain (see lib/services/branded-domain.ts), not just the main one —
          a visitor who lands here by curiosity needs an easy way back to the
          storefront instead of a dead end. */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Storefront className="size-4" />
        {t("backToShop")}
      </Link>
    </main>
  );
}
