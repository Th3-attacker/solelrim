import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
  ]),
]);

export default eslintConfig;
