import "@/src/instrumentation.server";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

// Point d'entrée serveur (celui par défaut de TanStack Start), précédé de
// l'initialisation de Sentry et de la vérification des variables
// d'environnement (ex-instrumentation.ts de Next.js).
export default createServerEntry({ fetch: createStartHandler(defaultStreamHandler) });
