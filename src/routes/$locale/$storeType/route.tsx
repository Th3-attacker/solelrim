import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ShopNotFound } from "@/components/errors/shop-not-found";
import { getStoreTypes } from "@/lib/queries/settings";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/layout.tsx et not-found.tsx.

// Every route under here assumes storeType is a real boutique — this is the
// single choke point that guarantees that, so no individual page has to
// re-check it before querying by productType.
const assertBoutique = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const storeTypes = await getStoreTypes();
    if (!storeTypes.some((type) => type.key === storeType)) throw notFound();
    return null;
  });

export const Route = createFileRoute("/$locale/$storeType")({
  loader: ({ params }) => assertBoutique({ data: { storeType: params.storeType } }),
  staleTime: Infinity,
  notFoundComponent: ShopNotFound,
});
