import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";
import { serverEnv } from "@/lib/env";
import { getStoreTypeRouting } from "@/lib/services/domain-cache";
import { getSiteUrl } from "@/lib/shop/site-url";
import {
  detectLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  localeFromPath,
} from "@/src/middleware/locale";
import {
  getAppRequestContext,
  setAppRequestContext,
  type AppRequestContext,
} from "@/src/server/request-context";

// Ex-proxy.ts : ce qui doit se passer avant toute page, route API ou server
// function. Les règles sont les mêmes, seule la mécanique change (TanStack
// Start au lieu du middleware Next.js / next-intl).

function isAdminPath(pathWithoutLocale: string) {
  return pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
}

// The only admin areas a SELLER may open — the checkout and everything
// under it (receipts, cash closing), and the help page.
function isSellerPath(pathWithoutLocale: string) {
  return (
    pathWithoutLocale === "/admin/pos" ||
    pathWithoutLocale.startsWith("/admin/pos/") ||
    pathWithoutLocale === "/admin/help"
  );
}

function isAdminLoginPath(pathWithoutLocale: string) {
  return pathWithoutLocale === "/admin/login" || pathWithoutLocale.startsWith("/admin/login/");
}

// Ce que le matcher de proxy.ts excluait : l'API, les fichiers (sitemap.xml,
// robots.txt, manifest.webmanifest, favicon.ico…) et les icônes générées à
// la racine. Ni préfixe de langue ni garde admin pour eux.
function isOutsidePages(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    /^\/icon(-\d+)?(\/|$)/.test(pathname) ||
    /\.[^/]+$/.test(pathname)
  );
}

// Hôte indexable = domaine de production (sans tenir compte du port) ou
// domaine boutique enregistré en base (voir le commentaire historique de
// proxy.ts : un miroir de prévisualisation ne doit jamais devenir un doublon
// indexé du vrai site).
function isIndexableHost(host: string, domainMap: Map<string, string>): boolean {
  const productionHost = new URL(getSiteUrl()).hostname.toLowerCase();
  return host === productionHost || domainMap.has(host);
}

function redirectTo(url: URL): Response {
  return new Response(null, { status: 307, headers: { Location: url.toString() } });
}

// 1. Le contexte de la requête (src/server/request-context.ts) : langue,
//    nonce, domaine de marque.
export const requestContextMiddleware = createMiddleware().server(
  async ({ request, handlerType, next }) => {
    const url = new URL(request.url);
    const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];

    let branded: AppRequestContext["branded"] = null;
    // Toutes les URL servies par le routeur (pages, manifeste et icônes de
    // boutique) suivent le domaine de marque ; l'API n'a pas de boutique dans
    // son chemin.
    if (handlerType === "router" && !url.pathname.startsWith("/api/")) {
      const { domainMap, keySet } = await getStoreTypeRouting();
      const key = domainMap.get(host);
      if (key) branded = { key, keys: [...keySet] };
    }

    // Une server function n'a pas de langue dans son URL : le navigateur
    // l'envoie dans un en-tête (src/middleware/locale-function.ts).
    const locale =
      handlerType === "serverFn"
        ? (localeFromPath(`/${request.headers.get(LOCALE_HEADER) ?? ""}`) ?? routing.defaultLocale)
        : (localeFromPath(url.pathname) ?? routing.defaultLocale);

    setAppRequestContext(request, {
      locale,
      nonce: newNonce(),
      branded,
      cookieOverlay: new Map(),
      actionEffects: { revalidated: false },
    });
    return next();
  },
);

// 2. Les en-têtes et redirections des pages et de l'API.
export const proxyMiddleware = createMiddleware().server(async ({ request, handlerType, next }) => {
  if (handlerType === "serverFn") return next();

  const url = new URL(request.url);
  const { pathname } = url;

  // /api/v1/docs (src/routes/api/v1/docs.ts) charge la référence Scalar
  // depuis jsDelivr ; le reste de l'API a la même politique, sans nonce.
  if (pathname.startsWith("/api/")) {
    setResponseHeader(
      "Content-Security-Policy",
      pathname === "/api/v1/docs"
        ? contentSecurityPolicy({ extraScriptSources: ["https://cdn.jsdelivr.net"] })
        : contentSecurityPolicy({}),
    );
    return next();
  }
  if (isOutsidePages(pathname)) return next();

  const context = getAppRequestContext();
  setResponseHeader("Content-Security-Policy", contentSecurityPolicy({ nonce: context?.nonce }));

  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (host) {
    const { domainMap } = await getStoreTypeRouting();
    if (!isIndexableHost(host, domainMap)) setResponseHeader("X-Robots-Tag", "noindex");
  }

  // Sans préfixe de langue : redirection vers la langue détectée.
  const locale = localeFromPath(pathname);
  if (!locale) {
    const target = new URL(url);
    target.pathname = `/${detectLocale(getCookie(LOCALE_COOKIE), request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
    return redirectTo(target);
  }
  // La langue choisie est retenue pour la prochaine visite sans préfixe.
  if (getCookie(LOCALE_COOKIE) !== locale) {
    setCookie(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax" });
  }

  const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");

  // Public storefront: no session check at all, no Supabase client created.
  if (!isAdminPath(pathWithoutLocale)) return next();

  const isLoginRoute = isAdminLoginPath(pathWithoutLocale);
  const env = serverEnv();
  const overlay = context?.cookieOverlay;
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          const cookies = new Map(Object.entries(getCookies()));
          for (const [name, value] of overlay ?? []) {
            if (value === null) cookies.delete(name);
            else cookies.set(name, value);
          }
          return [...cookies].map(([name, value]) => ({ name, value }));
        },
        // Le jeton rafraîchi part dans la réponse, et la suite de cette
        // requête (loaders, rendu) le voit déjà (cookieOverlay).
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options);
            overlay?.set(name, value);
          }
        },
      },
    },
  );

  const toAdminPath = (path: string) => {
    const target = new URL(url);
    target.pathname = `/${locale}${path}`;
    target.search = "";
    return redirectTo(target);
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return isLoginRoute ? next() : toAdminPath("/admin/login");
  }

  // A verified TOTP factor makes nextLevel "aal2" forever for this user —
  // signInWithPassword alone only ever reaches "aal1", so this is true
  // exactly when the password step succeeded but the code step hasn't yet.
  // Users with no factor enrolled have nextLevel === currentLevel and are
  // unaffected — 2FA is opt-in per admin, not sitewide.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaPending = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  if (mfaPending) {
    return isLoginRoute ? next() : toAdminPath("/admin/login");
  }

  // Stamped into app_metadata at creation (lib/actions/sellers.ts) — only a
  // service-role client can write it, so it's as tamper-proof as
  // mfa_required, and reading it here costs no database round trip. This is
  // routing only: the real guard is server-side (requireAdminScope and
  // getAdminScope both refuse a SELLER).
  const isSeller = user.app_metadata?.role === "SELLER";

  // A SUPERADMIN can mandate 2FA for a specific admin (setAdminMfaRequired,
  // written to app_metadata since only a service-role client can set it —
  // the targeted admin can't clear it on themselves). Until that admin has
  // a verified factor, every admin page but Settings (where they enroll
  // one) bounces them there instead of loading normally. Never applied to a
  // seller: they can't open Settings to enroll, so it would only loop.
  if (user.app_metadata?.mfa_required === true && !isSeller) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasFactor = (factors?.totp.length ?? 0) > 0;
    if (!hasFactor && pathWithoutLocale !== "/admin/settings") {
      return toAdminPath("/admin/settings");
    }
  }

  if (isSeller && !isSellerPath(pathWithoutLocale)) {
    return toAdminPath("/admin/pos");
  }

  if (isLoginRoute) {
    return toAdminPath("/admin");
  }

  return next();
});
