import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// The TanStack Start build of the app (src/), next to the Next.js one until
// the cutover. Shared code in lib/ is reused only where it doesn't import
// Next.js: importProtection below fails the build otherwise.

const root = import.meta.dirname;

// Imported from code that can end up in the browser, these fail the build.
const SERVER_ONLY = ["server-only", "@/lib/prisma", "@prisma/adapter-pg", "pg", "node:crypto"];
// Never in this build, on either side.
const NEXT_ONLY = [/^next($|\/)/, /^next-intl($|\/)/, /^@sentry\/nextjs/, "@/i18n/navigation"];

export default defineConfig(({ command, mode }) => {
  // Vercel hands the server its variables at runtime; `vite dev` has to read
  // the local .env files itself (without overriding the real environment).
  if (command === "serve") {
    for (const [name, value] of Object.entries(loadEnv(mode, root, ""))) {
      process.env[name] ??= value;
    }
  }

  return {
    server: { port: 3001 },
    // Tailwind runs as a Vite plugin (below), in both the browser and the
    // server builds; postcss.config.mjs stays the Next.js build's.
    css: { postcss: { plugins: [] } },
    // Both builds read the same public variables during the migration.
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    resolve: {
      tsconfigPaths: true,
      alias: {
        // The marker throws outside the react-server condition, which Start's
        // server doesn't use. importProtection keeps it out of the browser.
        "server-only": path.resolve(root, "node_modules/server-only/empty.js"),
      },
    },
    plugins: [
      tanstackStart({
        importProtection: {
          include: ["src/**", "lib/**"],
          client: { specifiers: [...SERVER_ONLY, ...NEXT_ONLY] },
          server: { specifiers: NEXT_ONLY },
        },
      }),
      nitro(),
      viteReact(),
      tailwindcss(),
    ],
  };
});
