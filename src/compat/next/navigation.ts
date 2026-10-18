import { useMemo } from "react";
import {
  notFound as routerNotFound,
  redirect as routerRedirect,
  useParams as useRouterParams,
  useRouter as useTanStackRouter,
  useRouterState,
} from "@tanstack/react-router";

// Remplace next/navigation sur TanStack Router. Les chemins sont toujours
// ceux de l'URL publique (sans segment boutique sur un domaine de marque) :
// le routeur les ramène lui-même à ses routes internes (src/router.tsx).

// Lancés depuis un loader, une server function ou le rendu : le routeur
// affiche le notFoundComponent le plus proche / suit la redirection.
export function notFound(): never {
  throw routerNotFound();
}

export function redirect(href: string): never {
  throw routerRedirect({ href });
}

// Le chemin de l'URL affichée dans la barre d'adresse.
export function usePathname(): string {
  const publicHref = useRouterState({ select: (state) => state.location.publicHref });
  return new URL(publicHref, "http://localhost").pathname;
}

// Les paramètres bruts de l'URL, comme les rendait Next.js (chaînes).
export function useSearchParams(): URLSearchParams {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouterParams({ strict: false } as Parameters<typeof useRouterParams>[0]) as T;
}

type NavigateOptions = { scroll?: boolean };

// L'API de useRouter() de Next.js : push / replace vers un chemin public,
// refresh() pour recharger les données de la page (ex-re-rendu serveur).
export function createRouterApi(
  router: ReturnType<typeof useTanStackRouter>,
  resolveHref: (href: string) => string = (href) => href,
) {
  const go = (href: string, replace: boolean, options?: NavigateOptions) =>
    router.navigate({ href: resolveHref(href), replace, resetScroll: options?.scroll !== false });
  return {
    push: (href: string, options?: NavigateOptions) => go(href, false, options),
    replace: (href: string, options?: NavigateOptions) => go(href, true, options),
    refresh: () => router.invalidate(),
    back: () => router.history.back(),
    forward: () => router.history.forward(),
    // `href` suffit au routeur (il le résout lui-même) ; son type exige `to`.
    prefetch: (href: string) =>
      router.preloadRoute({ href: resolveHref(href) } as Parameters<typeof router.preloadRoute>[0]),
  };
}

export function useRouter() {
  const router = useTanStackRouter();
  return useMemo(() => createRouterApi(router), [router]);
}
