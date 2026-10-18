import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { nextCompatAliases } from "./src/compat/aliases.ts";
import { serverActionsPlugin } from "./src/compat/server-actions-plugin.ts";
import { securityHeaders } from "./lib/security-headers.ts";
import { vercelImagesConfig } from "./lib/image-config.ts";

const root = import.meta.dirname;

export default defineConfig(({ command, mode }) => {
  // Vercel fournit les variables au serveur à l'exécution ; `vite dev` doit
  // lire lui-même les fichiers .env locaux (sans écraser l'environnement réel).
  for (const [name, value] of Object.entries(loadEnv(mode, root, ""))) {
    process.env[name] ??= value;
  }

  // Les variables NEXT_PUBLIC_* sont inlinées au build, exactement comme le
  // faisait Next.js : le code partagé (lib/supabase/storage.ts, lib/csp.ts…)
  // les lit via process.env, qui n'existe pas dans le navigateur.
  const publicEnv = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name]) => name.startsWith("NEXT_PUBLIC_"))
      .map(([name, value]) => [`process.env.${name}`, JSON.stringify(value)]),
  );
  // Vercel n'expose NEXT_PUBLIC_VERCEL_ENV qu'aux projets Next.js : on le
  // reconstruit depuis VERCEL_ENV pour Sentry (instrumentation-client), sauf
  // s'il est défini explicitement (.env.local, CI), qui reste prioritaire.
  publicEnv["process.env.NEXT_PUBLIC_VERCEL_ENV"] = JSON.stringify(
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV,
  );

  return {
    server: { port: 3000 },
    // @vercel/og lit sa police et son moteur WebAssembly à côté de son propre
    // fichier : il doit rester un module Node externe, jamais regroupé.
    ssr: { external: ["@vercel/og"] },
    define: {
      ...publicEnv,
      // L'optimiseur d'images de Vercel (/_vercel/image) n'existe qu'une fois
      // déployé : en local, les images sont servies telles quelles.
      __VERCEL_IMAGES__: JSON.stringify(command === "build" && !!process.env.VERCEL),
    },
    resolve: {
      alias: [
        { find: /^@\/(.*)$/, replacement: path.resolve(root, "$1") },
        // Le marqueur de Next devient celui de Start : un fichier qui importe
        // "server-only" ne peut plus être importé depuis le navigateur.
        { find: /^server-only$/, replacement: "@tanstack/react-start/server-only" },
        ...nextCompatAliases(root),
      ],
    },
    plugins: [
      serverActionsPlugin({ root }),
      tanstackStart({
        srcDirectory: "src",
        // CSRF : les server functions sont protégées par le middleware de
        // src/start.ts (createCsrfMiddleware).
        importProtection: {
          include: ["src/**", "lib/**", "components/**", "hooks/**", "i18n/**"],
          behavior: "error",
          // Le client Prisma et le pilote Postgres n'ont rien à faire dans le
          // navigateur : le build échoue s'ils y entrent, en nommant le chemin.
          client: {
            specifiers: [
              "@tanstack/react-start/server",
              "@/lib/prisma",
              "@/lib/generated/prisma/client",
              "@prisma/adapter-pg",
              "pg",
            ],
          },
        },
      }),
      nitro({
        // Les en-têtes de sécurité valent pour toutes les réponses, fichiers
        // statiques compris (servis par le CDN de Vercel sans passer par la
        // fonction) : ils vivent donc dans les routeRules de Nitro.
        routeRules: { "/**": { headers: securityHeaders() } },
        vercel: {
          config: {
            // Remplace l'optimiseur de next/image (next.config.ts) : mêmes
            // largeurs, même durée de cache, limité au stockage public Supabase.
            version: 3,
            images: vercelImagesConfig(),
            // Ex-vercel.json : la sortie de build Vercel porte ses propres crons.
            crons: [{ path: "/api/cron/expire-pending-orders", schedule: "0 6 * * *" }],
          },
        },
      }),
      viteReact(),
      tailwindcss(),
    ],
  };
});
