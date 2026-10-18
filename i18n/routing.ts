// Les langues de l'application. Ex-defineRouting de next-intl : la même
// forme ({ locales, defaultLocale, localePrefix }) pour que le code qui lit
// routing.locales / routing.defaultLocale n'ait pas à changer.
export const routing = {
  locales: ["en", "fr", "ar"],
  defaultLocale: "fr",
  // Toujours un préfixe de langue dans l'URL (/fr/…, /ar/…) : src/start.ts
  // redirige une URL sans préfixe vers la langue détectée.
  localePrefix: "always",
} as const;

export type Locale = (typeof routing.locales)[number];

// Remplace hasLocale de next-intl.
export function hasLocale(locale: unknown): locale is Locale {
  const locales: readonly unknown[] = routing.locales;
  return locales.includes(locale);
}

const rtlLocales: readonly string[] = ["ar"];

export function getDirection(locale: string): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

// Le fuseau horaire de tous les formatages de dates. Next.js n'en fixait
// aucun et prenait celui du serveur (UTC sur Vercel) des deux côtés : on le
// fixe explicitement pour que le rendu serveur et le navigateur concordent.
export const TIME_ZONE = "UTC";
