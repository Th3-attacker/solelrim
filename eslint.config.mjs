import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Ex-eslint-config-next (core-web-vitals + typescript) : les règles qui ne
// dépendaient pas de Next.js — TypeScript recommandé et règles des hooks
// React — sans le plugin @next/next, qui n'a plus d'objet.
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      // Allow a leading underscore to mark a destructured/unused binding as
      // intentional (e.g. stripping `id` off a variant before re-creating
      // it) instead of having to reshape the code around the rule.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    // Sorties de build (TanStack Start / Nitro / Vercel) et code généré.
    ".output/**",
    ".tanstack/**",
    ".vercel/**",
    ".next/**",
    "lib/generated/**",
    "src/routeTree.gen.ts",
    // vitest --coverage output (lib/shop/*.test.ts and friends) — generated,
    // gitignored, and its bundled html-reporter assets aren't this
    // project's own code.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
