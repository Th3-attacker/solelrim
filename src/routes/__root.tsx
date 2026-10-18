import type { ReactNode } from "react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useParams,
} from "@tanstack/react-router";
import { getDirection, hasLocale, routing } from "@/i18n/routing";
import { mergeMetadata, metadataToHead, type ResolvedMetadata } from "@/lib/seo/head";
import type { BrandedDomain } from "@/lib/services/branded-domain";
import { cn } from "@/lib/utils";
import { useNonce } from "@/hooks/use-nonce";
import { GlobalError, RootNotFound } from "@/components/errors/global-error";
import globalsCss from "@/src/styles/globals.css?url";

// Ex-app/[locale]/layout.tsx pour la partie document (<html>, <head>) et
// ex-app/global-error.tsx. Les fournisseurs (traductions, thème…) vivent dans
// src/routes/$locale/route.tsx.

type RouterContext = { branded: BrandedDomain | null };

export const Route = createRootRouteWithContext<RouterContext>()({
  // Les métadonnées de tous les niveaux de la page, fusionnées du parent vers
  // l'enfant (lib/seo/head.ts) : chaque loader renvoie les siennes dans `meta`.
  head: ({ matches }) => {
    const levels = matches.map(
      (match) => (match.loaderData as { meta?: ResolvedMetadata } | undefined)?.meta,
    );
    const { meta, links } = metadataToHead(mergeMetadata(levels));
    return {
      meta: [
        { charSet: "utf-8" },
        // Shrinks the actual layout viewport (not just the visual one) when the
        // on-screen keyboard opens, so `position: fixed` bottom sheets and their
        // dvh-based heights resize to sit flush above the keyboard instead of
        // floating above it (iOS Safari 16.4+ / Android Chrome 108+).
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
        },
        ...meta,
      ],
      links: [
        { rel: "stylesheet", href: globalsCss },
        // Ex-conventions de fichiers de Next.js (app/favicon.ico, app/icon.tsx).
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", href: "/icon", type: "image/png", sizes: "32x32" },
        // Icône d'écran d'accueil iOS (180x180, fond plein : iOS arrondit
        // lui-même les coins) ; sans elle, Safari prend une capture de la page.
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        ...links,
      ],
    };
  },
  shellComponent: RootDocument,
  component: Outlet,
  errorComponent: GlobalError,
  notFoundComponent: RootNotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale: param } = useParams({ strict: false });
  const locale = hasLocale(param) ? param : routing.defaultLocale;
  const { branded } = Route.useRouteContext();
  const nonce = useNonce();

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <head>
        <HeadContent />
        {/* Lu par src/router.tsx au démarrage du routeur dans le navigateur. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `window.__BRANDED_DOMAIN__=${JSON.stringify(branded).replace(/</g, "\\u003c")};`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
