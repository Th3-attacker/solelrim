import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { toInternalPath, toPublicPath, type BrandedDomain } from "@/lib/services/branded-domain";
import { GlobalError, RootNotFound } from "@/components/errors/global-error";
import { getAppRequestContext } from "@/src/server/request-context";
import { routeTree } from "./routeTree.gen";

declare global {
  interface Window {
    // Posé par src/routes/__root.tsx avant le chargement des scripts : le
    // domaine de marque de la page, pour que la navigation côté navigateur
    // réécrive les URL comme le serveur.
    __BRANDED_DOMAIN__?: BrandedDomain | null;
  }
}

// Ce que le routeur doit savoir de la requête : le nonce CSP de ses propres
// scripts (serveur seulement) et le domaine de marque éventuel.
const getRequestRouting = createIsomorphicFn()
  .server(() => {
    const context = getAppRequestContext();
    return { nonce: context?.nonce, branded: context?.branded ?? null };
  })
  .client(() => ({ nonce: undefined, branded: window.__BRANDED_DOMAIN__ ?? null }));

// Les paramètres d'URL restent des chaînes, comme les searchParams de
// Next.js (le format par défaut de TanStack Router convertirait "2" en
// nombre et sérialiserait les objets en JSON).
function parseSearch(searchStr: string): Record<string, string | string[]> {
  const params = new URLSearchParams(searchStr);
  const search: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    search[key] = values.length > 1 ? values : values[0];
  }
  return search;
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getRouter() {
  const { nonce, branded } = getRequestRouting();

  return createRouter({
    routeTree,
    context: { branded },
    scrollRestoration: true,
    // Préchargement des données au survol des liens : la page suivante est
    // souvent prête au clic, comme avec le prefetch de Next.js.
    defaultPreload: "intent",
    // Les squelettes (ex-loading.tsx) n'apparaissent que si le chargement
    // dure, puis restent assez longtemps pour ne pas clignoter.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    // Toute route sans frontière propre retombe sur celles-ci (ex-global-error
    // et 404 par défaut de Next.js).
    defaultErrorComponent: GlobalError,
    defaultNotFoundComponent: RootNotFound,
    parseSearch,
    stringifySearch,
    ssr: { nonce },
    // Domaine de marque (lib/services/branded-domain.ts) : URL publique sans
    // segment boutique ↔ route interne /$locale/$storeType/….
    ...(branded && {
      rewrite: {
        input: ({ url }) => {
          const internal = toInternalPath(url.pathname, branded);
          if (!internal) return undefined;
          url.pathname = internal;
          return url;
        },
        output: ({ url }) => {
          const publicPath = toPublicPath(url.pathname, branded);
          if (!publicPath) return undefined;
          url.pathname = publicPath;
          return url;
        },
      },
    }),
  });
}
