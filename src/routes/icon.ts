import { createFileRoute } from "@tanstack/react-router";
import { solalIcon } from "@/src/server/icons";

// Ex-app/icon.tsx : le favicon de la plateforme (32x32).
export const Route = createFileRoute("/icon")({
  server: { handlers: { GET: () => solalIcon(32) } },
});
