import { hasLocale } from "@/i18n/routing";

// Le domaine propre d'une boutique (StoreType.domain) sert sa vitrine sans
// segment /{boutique} visible : /fr/products sur sport.example.com est en
// interne /fr/sport/products. Ex-réécriture de proxy.ts, désormais faite par
// le routeur lui-même (option `rewrite` de src/router.tsx), côté serveur
// comme côté navigateur, pour que la navigation client suive la même règle.
//
// `keys` liste toutes les boutiques : sur un domaine de marque, une autre
// boutique tapée à la main dans l'URL est ignorée (le domaine ne sert que la
// sienne).
export type BrandedDomain = { key: string; keys: string[] };

// Sous un domaine de marque, ces chemins ne sont pas réécrits : l'admin y
// reste joignable tel quel, et l'image OpenGraph par défaut vit au-dessus du
// segment boutique (/{locale}/opengraph-image).
function isUnrewrittenPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === "/admin" ||
    pathWithoutLocale.startsWith("/admin/") ||
    /^\/(opengraph-image|twitter-image)(\/|$)/.test(pathWithoutLocale)
  );
}

function splitLocale(pathname: string): { locale: string; rest: string[] } | null {
  const [, maybeLocale, ...rest] = pathname.split("/");
  if (!hasLocale(maybeLocale)) return null;
  return { locale: maybeLocale, rest: rest.filter(Boolean) };
}

// URL publique → URL interne : /fr/products → /fr/sport/products.
export function toInternalPath(pathname: string, branded: BrandedDomain): string | null {
  const parts = splitLocale(pathname);
  if (!parts) return null;
  const { locale, rest } = parts;
  if (isUnrewrittenPath(`/${rest.join("/")}`)) return null;
  if (rest[0] === branded.key) return null;
  const tail = rest[0] && branded.keys.includes(rest[0]) ? rest.slice(1) : rest;
  return `/${locale}/${branded.key}${tail.length ? `/${tail.join("/")}` : ""}`;
}

// URL interne → URL publique : /fr/sport/products → /fr/products.
export function toPublicPath(pathname: string, branded: BrandedDomain): string | null {
  const parts = splitLocale(pathname);
  if (!parts || parts.rest[0] !== branded.key) return null;
  const tail = parts.rest.slice(1);
  return `/${parts.locale}${tail.length ? `/${tail.join("/")}` : ""}`;
}
