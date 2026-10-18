import { hasLocale, routing, type Locale } from "@/i18n/routing";

// En-tête par lequel le navigateur indique sa langue courante à chaque appel
// de server function (src/middleware/locale-function.ts) : l'URL de ces
// appels (/_serverFn/…) ne porte pas de préfixe de langue.
export const LOCALE_HEADER = "x-app-locale";

// Même cookie que next-intl, pour qu'un visiteur garde sa langue après la
// migration.
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return hasLocale(first) ? first : null;
}

// La langue préférée d'Accept-Language parmi celles de l'application
// (ex-détection de next-intl) : la première, par ordre de préférence, dont la
// langue de base est prise en charge.
function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.base && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.base).find(hasLocale) ?? null;
}

// Pour une URL sans préfixe : le cookie de langue, sinon le navigateur, sinon
// la langue par défaut.
export function detectLocale(cookieLocale: string | undefined, acceptLanguage: string | null) {
  if (hasLocale(cookieLocale)) return cookieLocale;
  return localeFromAcceptLanguage(acceptLanguage) ?? routing.defaultLocale;
}
