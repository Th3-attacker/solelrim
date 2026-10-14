import { use, type ReactNode } from "react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { IntlProvider, useTranslations } from "use-intl";
import { TIME_ZONE, isLocale } from "~/i18n/config";
import { detectLocale } from "~/i18n/detect";
import { loadMessages } from "~/i18n/messages";
import { NotFound } from "~/components/not-found";
import { RootError } from "~/components/route-error";
import { ToastProvider } from "~/components/ui/toast";

export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params, location }) => {
    if (isLocale(params.locale)) return { locale: params.locale };
    // An address without a language ("/admin/orders"): the same one in the
    // visitor's, where it is found or gets that language's 404 page.
    throw redirect({ href: `/${detectLocale()}${location.href}` });
  },
  // Started here so the messages load alongside the page's own data.
  loader: ({ context }) => {
    void loadMessages(context.locale);
  },
  component: LocaleLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function LocaleLayout() {
  const { locale } = Route.useRouteContext();
  const messages = use(loadMessages(locale));

  return (
    <IntlProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
      <Notifications>
        <Outlet />
      </Notifications>
    </IntlProvider>
  );
}

function Notifications({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  return <ToastProvider closeLabel={t("close")}>{children}</ToastProvider>;
}
