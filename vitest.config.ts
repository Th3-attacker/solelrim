import path from "node:path";
import { defineConfig } from "vitest/config";
// Extension `.ts` explicite : voir le commentaire équivalent dans vite.config.ts.
import { nextCompatAliases } from "./src/compat/aliases.ts";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".output", ".vercel"],
    // Report-only for now — no `thresholds`, so a low or dropping number
    // never fails the run. lib/generated is Prisma's own output, not code
    // this project owns, so it's excluded from the report.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**", "components/**", "lib/**"],
      exclude: ["lib/generated/**", "src/routeTree.gen.ts", "**/*.test.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(import.meta.dirname, "$1") },
      // The marker throws outside the react-server condition; tests run server
      // modules in plain Node.
      {
        find: /^server-only$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
      },
      // Les mêmes remplaçants de Next.js que l'application (src/compat).
      ...nextCompatAliases(import.meta.dirname),
    ],
  },
});
