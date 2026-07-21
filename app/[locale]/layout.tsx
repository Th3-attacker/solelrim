import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DirectionProvider } from "@radix-ui/react-direction";
import "../globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing, getDirection } from "@/i18n/routing";

// Body/heading font is the native OS UI font stack (SF Pro on Apple
// devices) defined in globals.css's --font-sans — no webfont to load here.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: `Solelrim — ${t("title")}` };
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
              {children}
              <Toaster />
            </ThemeProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
