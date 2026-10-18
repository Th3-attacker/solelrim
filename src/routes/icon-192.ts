import { createFileRoute } from "@tanstack/react-router";
import { solalIcon } from "@/src/server/icons";

// Ex-app/icon-192/route.tsx : icône du manifeste racine.
export const Route = createFileRoute("/icon-192")({
  server: { handlers: { GET: () => solalIcon(192) } },
});
