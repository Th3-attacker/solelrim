import "@/src/instrumentation.client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Point d'entrée navigateur (celui par défaut de TanStack Start), précédé de
// l'initialisation de Sentry (ex-instrumentation-client.ts de Next.js).
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
