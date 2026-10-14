import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js's own rules (next/head, next/link, next/image…) don't apply to the
// TanStack Start build in src/.
const nextPlugin = nextVitals.find((config) => config.plugins?.["@next/next"])?.plugins[
  "@next/next"
];
const nextRulesOff = Object.fromEntries(
  Object.keys(nextPlugin?.rules ?? {}).map((rule) => [`@next/next/${rule}`, "off"]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/**"], rules: nextRulesOff },
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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // vitest --coverage output (lib/shop/*.test.ts and friends) — generated,
    // gitignored, and its bundled html-reporter assets aren't this
    // project's own code.
    "coverage/**",
    // TanStack Start: build output, and the route tree it generates.
    ".output/**",
    ".nitro/**",
    ".tanstack/**",
    "src/routeTree.gen.ts",
  ]),
]);

export default eslintConfig;
