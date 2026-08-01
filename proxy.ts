import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getStoreTypeRouting } from "@/lib/shop/domain-cache";
import { NOT_FOUND_STORE_TYPE_KEY } from "@/lib/shop/product-type";

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

  if (boutiqueKey) {
    if (isAdminPath(pathWithoutLocale)) {
      // /admin is never reachable via a boutique's branded domain — only
      // the main domain. Rewrite to a storeType key that can never be a
      // real boutique (RESERVED_STORE_TYPE_KEYS) so this renders the
      // app's actual styled 404 instead of a bare empty response.
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/${NOT_FOUND_STORE_TYPE_KEY}`;
      return NextResponse.rewrite(url);
    }

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

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/admin/login`;
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/admin`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
