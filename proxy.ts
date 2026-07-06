import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

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
  const locale = routing.locales.includes(
    maybeLocale as (typeof routing.locales)[number],
  )
    ? maybeLocale
    : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(2).join("/");

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
