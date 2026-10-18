import path from "node:path";
import type { Plugin } from "vite";

// Les server actions de Next.js ("use server", lib/actions/*.ts) restent des
// fonctions ordinaires côté serveur. Dans le bundle du navigateur, chacune
// est remplacée par une référence qui l'appelle à distance via une seule
// server function TanStack Start (src/server/server-actions.functions.ts) :
// les composants continuent d'importer et d'appeler `login(...)`,
// `updateOrderStatus(...)`… exactement comme avant.
const USE_SERVER = /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*["']use server["'];?/;
const EXPORTED_FUNCTION = /^export\s+async\s+function\s+(\w+)/gm;

export function serverActionsPlugin({ root }: { root: string }): Plugin {
  return {
    name: "solal:server-actions",
    enforce: "pre",
    transform(code, id) {
      if (this.environment?.name !== "client") return;
      if (!USE_SERVER.test(code)) return;

      // Identifiant stable de l'action : son fichier depuis la racine du projet.
      const file = `/${path.relative(root, id.split("?")[0]).split(path.sep).join("/")}`;
      const names = [...code.matchAll(EXPORTED_FUNCTION)].map((match) => match[1]);

      const references = names.map(
        (name) =>
          `export const ${name} = createServerActionReference(${JSON.stringify(file)}, ${JSON.stringify(name)});`,
      );
      return {
        code: [
          `import { createServerActionReference } from "@/src/compat/server-action-reference";`,
          ...references,
        ].join("\n"),
        map: null,
      };
    },
  };
}
