import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getStoreTypeRouting } from "@/lib/shop/domain-cache";

const handleI18nRouting = createIntlMiddleware(routing);

function isAdminPath(pathWithoutLocale: string) {
  return (
    pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/")
  );
}

function isAdminLoginPath(pathWithoutLocale: string) {
  return (
    pathWithoutLocale === "/admin/login" ||
    pathWithoutLocale.startsWith("/admin/login/")
  );
}

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  const segments = request.nextUrl.pathname.split("/");
  const maybeLocale = segments[1];
  const hasLocalePrefix = routing.locales.includes(
    maybeLocale as (typeof routing.locales)[number],
  );
  const locale = hasLocalePrefix ? maybeLocale : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(2).join("/");

  // Without a locale prefix yet, handleI18nRouting's response above is
  // itself a redirect that adds one — let that go out untouched. Domain
  // resolution below needs a real, already-prefixed path to work with, and
  // naturally applies on the follow-up request once the browser follows
  // this redirect.
  if (!hasLocalePrefix) {
    return response;
  }

  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { domainMap, keySet } = await getStoreTypeRouting();
  const boutiqueKey = domainMap.get(host);

  // /admin is left untouched here (no rewrite into the boutique's storefront
  // segment below) so it falls straight through to the normal admin
  // auth/2FA flow further down — same behavior whether reached via the
  // main domain or a boutique's own branded domain. Login sets the
  // Supabase session cookie scoped to whichever host was used, so it works
  // as long as the admin stays on that same domain for the whole session.
  if (boutiqueKey && !isAdminPath(pathWithoutLocale)) {
    const segs = pathWithoutLocale.split("/").filter(Boolean);
    const first = segs[0];

    if (first !== boutiqueKey) {
      // Either no storeType segment at all (bare root, "/about", ...) or a
      // different real boutique's key typed by hand — either way, a
      // branded domain only ever serves its own boutique.
      const rest = first && keySet.has(first) ? segs.slice(1) : segs;
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/${boutiqueKey}${rest.length ? "/" + rest.join("/") : ""}`;
      return NextResponse.rewrite(url);
    }
    // Already correct (normal internal navigation) — fall through.
  }

  // Public storefront: no session check at all, no Supabase client created.
  if (!isAdminPath(pathWithoutLocale)) {
    return response;
  }

  const isLoginRoute = isAdminLoginPath(pathWithoutLocale);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // A verified TOTP factor makes nextLevel "aal2" forever for this user —
  // signInWithPassword alone only ever reaches "aal1", so this is true
  // exactly when the password step succeeded but the code step hasn't yet.
  // Users with no factor enrolled have nextLevel === currentLevel and are
  // unaffected — 2FA is opt-in per admin, not sitewide.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaPending = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  if (mfaPending) {
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // A SUPERADMIN can mandate 2FA for a specific admin (setAdminMfaRequired,
  // written to app_metadata since only a service-role client can set it —
  // the targeted admin can't clear it on themselves). Until that admin has
  // a verified factor, every admin page but Settings (where they enroll
  // one) bounces them there instead of loading normally.
  if (user.app_metadata?.mfa_required === true) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasFactor = (factors?.totp.length ?? 0) > 0;
    if (!hasFactor && pathWithoutLocale !== "/admin/settings") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/settings`;
      return NextResponse.redirect(url);
    }
  }

  if (isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/admin`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // icon (and this app's extra icon-192, icon-512 routes) is Next's
  // dot-less metadata file-convention route living at the app root —
  // without this exclusion the i18n redirect below caught it same as any
  // other path, sending it to /{locale}/icon (a 404) instead of the actual
  // image. That silently broke the favicon. opengraph-image lives under
  // [locale] (so it can render a localized tagline) and is already
  // locale-prefixed, so it doesn't need the same exclusion.
  matcher: ["/((?!api|_next|_vercel|icon|.*\\..*).*)"],
};
