import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // Report-only for now — no `thresholds`, so a low or dropping number
    // never fails the run. lib/generated is Prisma's own output, not code
    // this project owns, so it's excluded from the report.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**", "components/**", "lib/**", "src/**"],
      exclude: ["lib/generated/**", "src/routeTree.gen.ts", "**/*.test.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "~": path.resolve(__dirname, "src"),
      // The marker throws outside the react-server condition; tests run server
      // modules in plain Node, like Next.js does on the server.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
