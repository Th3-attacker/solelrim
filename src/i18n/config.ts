import { DEFAULT_LOCALE, LOCALES, isAppLocale, type AppLocale } from "@/lib/i18n-locales";

// The app's languages. Same set, default and cookie as the Next.js build
// (i18n/routing.ts, next-intl), so a visitor's choice survives the cutover.

export { DEFAULT_LOCALE, LOCALES };
export type Locale = AppLocale;
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Every date the admin shows is Mauritanian time, whatever the device says:
// server and browser format alike, so hydration never disagrees.
export const TIME_ZONE = "Africa/Nouakchott";

export const isLocale = isAppLocale;

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

// The language to send a visitor to when the URL doesn't name one: the one
// they picked before (cookie), else the first of their browser's languages
// the app speaks, else the default.
export function pickLocale({
  cookie,
  acceptLanguage,
}: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(cookie)) return cookie;

  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return { language: tag.toLowerCase().split("-")[0], quality, index };
    })
    .filter(({ language, quality }) => language && quality > 0 && !Number.isNaN(quality))
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return (
    (ranked.find(({ language }) => isLocale(language))?.language as Locale | undefined) ??
    DEFAULT_LOCALE
  );
}
