import type { Metadata } from "next";
import { Storefront } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth.login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      {children}
      {/* /admin/login is now reachable from a boutique's own branded
          domain (see proxy.ts), not just the main one — a visitor who
          lands here by curiosity needs an easy way back to the storefront
          instead of a dead end. */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Storefront className="size-4" />
        {t("backToShop")}
      </Link>
    </div>
  );
}
