// The app's languages, free of any framework: next-intl's routing
// (i18n/routing.ts), the TanStack Start build (src/i18n/config.ts) and the
// messages sent to customers (lib/shop/client-messages.ts) all read them here.
export const LOCALES = ["en", "fr", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
