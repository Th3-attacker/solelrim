import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DirectionProvider } from "@radix-ui/react-direction";
import "../globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup";
import { Toaster } from "@/components/ui/toast";
import { routing, getDirection } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/shop/site-url";

// Body/heading font is the native OS UI font stack (SF Pro on Apple
// devices) defined in globals.css's --font-sans — no webfont to load here.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Shrinks the actual layout viewport (not just the visual one) when the
// on-screen keyboard opens, so `position: fixed` bottom sheets and their
// dvh-based heights resize to sit flush above the keyboard instead of
// floating above it (iOS Safari 16.4+ / Android Chrome 108+).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

// Sane defaults every page inherits unless it overrides them (Next merges
// metadata per-field across nested generateMetadata calls) — the public
// storefront pages (shop layout, about, contact, product detail) all
// override title/description/openGraph with boutique- or product-specific
// values; this only really surfaces as-is on admin pages, which robots.ts
// already keeps out of search results.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return {
    metadataBase: new URL(getSiteUrl()),
    title: `SOLAL — ${t("title")}`,
    description: t("metaDescription"),
    openGraph: { siteName: "SOLAL", type: "website" },
    twitter: { card: "summary" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const direction = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <DirectionProvider dir={direction}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ServiceWorkerCleanup />
              {children}
              <Toaster />
            </ThemeProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
