import { useMemo, type AnchorHTMLAttributes, type ComponentType, type Ref } from "react";
import {
  Link as RouterLink,
  redirect as routerRedirect,
  useRouter as useTanStackRouter,
} from "@tanstack/react-router";
import { useLocale } from "use-intl";
import { createRouterApi, usePathname as usePublicPathname } from "@/src/compat/next/navigation";
import { hasLocale } from "@/i18n/routing";

// Ex-createNavigation de next-intl : les mêmes Link / redirect / usePathname /
// useRouter, qui ajoutent ou retirent le préfixe de langue des chemins.

type Href = string | { pathname: string; hash?: string; query?: Record<string, string> };

function hrefToString(href: Href): string {
  if (typeof href === "string") return href;
  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname}${query}${href.hash ? `#${href.hash}` : ""}`;
}

// "/products" → "/fr/products", "/" → "/fr". Les liens externes, ancres et
// chemins relatifs restent tels quels.
export function localizeHref(href: Href, locale: string): string {
  const value = hrefToString(href);
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const [path, suffix = ""] = value.split(/(?=[?#])/, 2);
  return `/${locale}${path === "/" ? "" : path}${suffix}`;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href;
  locale?: string;
  // Next.js préchargeait les liens visibles ; ici, au survol (src/router.tsx).
  prefetch?: boolean | null;
  scroll?: boolean;
  replace?: boolean;
};

// Le Link du routeur accepte une URL complète (`href`) qu'il résout lui-même,
// réécriture des domaines de marque comprise ; son type n'admet que `to`
// (un chemin de route), d'où cette vue non typée.
const HrefLink = RouterLink as unknown as ComponentType<Record<string, unknown>>;

// React 19 : `ref` est une prop ordinaire (Button asChild la transmet).
export function Link({
  href,
  locale,
  prefetch,
  scroll,
  replace,
  ref,
  ...props
}: LinkProps & { ref?: Ref<HTMLAnchorElement> }) {
  const currentLocale = useLocale();
  return (
    <HrefLink
      {...props}
      ref={ref}
      href={localizeHref(href, locale ?? currentLocale)}
      replace={replace}
      resetScroll={scroll !== false}
      {...(prefetch === false ? { preload: false } : {})}
    />
  );
}

// Lancé depuis une server function ou un loader (ex-redirect de next-intl).
export function redirect({ href, locale }: { href: Href; locale: string }): never {
  throw routerRedirect({ href: localizeHref(href, locale) });
}

// Le chemin affiché, sans son préfixe de langue : "/fr/admin" → "/admin".
export function usePathname(): string {
  const pathname = usePublicPathname();
  const [, first, ...rest] = pathname.split("/");
  return hasLocale(first) ? `/${rest.join("/")}` : pathname;
}

type LocaleNavigateOptions = { locale?: string; scroll?: boolean };

export function useRouter() {
  const router = useTanStackRouter();
  const currentLocale = useLocale();
  return useMemo(() => {
    const api = createRouterApi(router);
    const localized = (href: string, options?: LocaleNavigateOptions) =>
      localizeHref(href, options?.locale ?? currentLocale);
    return {
      ...api,
      push: (href: string, options?: LocaleNavigateOptions) =>
        api.push(localized(href, options), options),
      replace: (href: string, options?: LocaleNavigateOptions) =>
        api.replace(localized(href, options), options),
      prefetch: (href: string, options?: LocaleNavigateOptions) =>
        api.prefetch(localized(href, options)),
    };
  }, [router, currentLocale]);
}
