import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { LoginForm } from "~/features/auth/login-form";
import { guardAdminPage } from "~/features/auth/guard";
import { Icon, type IconName } from "~/components/ui/icon";
import { LanguageSwitcher } from "~/components/layout/language-switcher";
import { Logo } from "~/components/layout/sidebar";

export const Route = createFileRoute("/$locale/admin/login")({
  // Already signed in: straight to the admin.
  beforeLoad: async ({ context, location }) => {
    await guardAdminPage({ queryClient: context.queryClient, locale: context.locale, location });
  },
  component: LoginPage,
});

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "pos", title: "showcaseMobilePaymentTitle", body: "showcaseMobilePaymentBody" },
  { icon: "orders", title: "showcaseWhatsappTitle", body: "showcaseWhatsappBody" },
  { icon: "shield", title: "showcasePosTitle", body: "showcasePosBody" },
];

function LoginPage() {
  const t = useTranslations("auth.login");
  const { locale } = Route.useRouteContext();

  return (
    <div className="flex min-h-dvh flex-wrap bg-surface">
      <main className="flex min-h-dvh flex-[1_1_480px] flex-col px-6 py-10 md:px-12">
        <Logo className="block h-[34px] self-start" />
        <div className="flex flex-1 items-center justify-center py-12">
          <LoginForm locale={locale} />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
          <span>© SOLAL · Nouakchott</span>
          <LanguageSwitcher />
        </footer>
      </main>

      {/* The brand side, decoration only: hidden on phones. */}
      <aside className="relative hidden flex-[1_1_480px] flex-col justify-between gap-10 overflow-hidden bg-[#1e3a5f] p-12 text-white md:flex">
        <img
          src="/brand/solal-symbol-white.svg"
          alt=""
          className="pointer-events-none absolute -end-30 -bottom-36 w-[520px] opacity-[0.07]"
        />
        <p className="text-[11px] font-bold tracking-[1.5px] text-[#7fb2e5]">
          {t("showcaseEyebrow")}
        </p>
        <div className="relative max-w-[460px]">
          <h2 className="text-[40px] leading-[46px] font-bold tracking-[-1px]">
            {t("showcaseHeadline")}
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3.5">
                <span className="inline-flex size-9 flex-none items-center justify-center rounded-control bg-white/10">
                  <Icon name={feature.icon} />
                </span>
                <span>
                  <b className="block text-[15px]">{t(feature.title)}</b>
                  <span className="text-[14px] text-[#d6e2f0]">{t(feature.body)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[13px] text-[#d6e2f0]">solal-rim.com</p>
      </aside>
    </div>
  );
}
