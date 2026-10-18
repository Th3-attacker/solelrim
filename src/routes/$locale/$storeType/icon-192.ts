import { createFileRoute } from "@tanstack/react-router";
import { boutiqueIcon } from "@/src/server/icons";

// Ex-app/[locale]/[storeType]/icon-192/route.tsx.
export const Route = createFileRoute("/$locale/$storeType/icon-192")({
  server: {
    handlers: { GET: ({ params }) => boutiqueIcon(params.locale, params.storeType, 192) },
  },
});
