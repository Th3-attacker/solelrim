import { createFileRoute } from "@tanstack/react-router";
import { solalIcon } from "@/src/server/icons";

// Ex-app/icon-512/route.tsx : icône du manifeste racine.
export const Route = createFileRoute("/icon-512")({
  server: { handlers: { GET: () => solalIcon(512) } },
});
