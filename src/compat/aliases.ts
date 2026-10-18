import path from "node:path";

// Couche de compatibilité Next.js → TanStack Start.
//
// Les composants (components/) et le code partagé (lib/, hooks/) importent
// encore les API de Next.js et de next-intl. Plutôt que de réécrire chacun de
// ces fichiers, ces modules sont redirigés vers des équivalents construits sur
// TanStack Start / TanStack Router / use-intl (src/compat/**). Next.js n'est
// plus installé : ces chemins ne désignent plus que ces remplacements.
//
// La même table sert à Vite (vite.config.ts), à Vitest (vitest.config.ts) et,
// sous forme de "paths", à TypeScript (tsconfig.json).
export const NEXT_COMPAT_MODULES = {
  next: "src/compat/next/index.ts",
  "next/navigation": "src/compat/next/navigation.ts",
  "next/image": "src/compat/next/image.tsx",
  "next/headers": "src/compat/next/headers.ts",
  "next/cache": "src/compat/next/cache.ts",
  "next/server": "src/compat/next/server.ts",
  "next-intl": "src/compat/next-intl/index.tsx",
  "next-intl/server": "src/compat/next-intl/server.ts",
} as const;

// Alias exacts (ancrés) : "next" ne doit pas capturer "next-themes".
export function nextCompatAliases(root: string): { find: RegExp; replacement: string }[] {
  return Object.entries(NEXT_COMPAT_MODULES).map(([specifier, file]) => ({
    find: new RegExp(`^${specifier.replace(/[/-]/g, "\\$&")}$`),
    replacement: path.resolve(root, file),
  }));
}
