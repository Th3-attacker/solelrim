import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DirectionProvider } from "@radix-ui/react-direction";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { useNonce } from "@/hooks/use-nonce";
import { loadMessages } from "@/i18n/messages";
import { getDirection, hasLocale } from "@/i18n/routing";
import { resolveMetadata } from "@/lib/seo/head";
import { getSiteUrl } from "@/lib/shop/site-url";

// Ex-app/[locale]/layout.tsx.

// Sane defaults every page inherits unless it overrides them — the public
// storefront pages (shop layout, about, contact, product detail) all
// override title/description/openGraph with boutique- or product-specific
// values; this only really surfaces as-is on admin pages, which robots.txt
// already keeps out of search results.
const getLocaleMetadata = createServerFn({ method: "GET" })
  .validator((locale: string) => locale)
  .handler(async ({ data: locale }) => {
    const t = await getTranslations({ locale, namespace: "dashboard" });
    return resolveMetadata({
      metadataBase: new URL(getSiteUrl()),
      title: `SOLAL — ${t("title")}`,
      description: t("metaDescription"),
      applicationName: "Solal",
      manifest: "/manifest.webmanifest",
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        locale: "fr_FR",
        url: getSiteUrl(),
        siteName: "Solal",
        title: "Solal | Vêtements de sport en Mauritanie",
        description:
          "Découvrez nos vêtements de sport, de musculation et de fitness pour hommes et femmes.",
        // L'image générée par src/routes/$locale/opengraph-image.ts, qui
        // l'emportait chez Next.js sur toute image déclarée ici (convention
        // de fichier opengraph-image).
        images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630 }],
      },
      twitter: { card: "summary" },
      robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    });
  });

export const Route = createFileRoute("/$locale")({
  loader: async ({ params }) => {
    if (!hasLocale(params.locale)) throw notFound();
    const [messages, meta] = await Promise.all([
      loadMessages(params.locale),
      getLocaleMetadata({ data: params.locale }),
    ]);
    return { messages, meta };
  },
  // Comme un layout Next.js : pas rechargé à chaque navigation, seulement
  // quand la langue change ou que les données sont invalidées.
  staleTime: Infinity,
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  const { messages } = Route.useLoaderData();
  const direction = getDirection(locale);
  // The page's CSP nonce, for next-themes' inline script.
  const nonce = useNonce();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DirectionProvider dir={direction}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <ServiceWorkerCleanup />
          <Outlet />
          <Toaster />
        </ThemeProvider>
      </DirectionProvider>
    </NextIntlClientProvider>
  );
}
