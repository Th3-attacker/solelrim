import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@/i18n/navigation";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";

// "/" has no boutique of its own — it always redirects to the default one
// (StoreSettings.productType), falling back to the first StoreType if that
// pointer is somehow stale (e.g. its boutique was since deleted).
const getDefaultBoutique = createServerFn({ method: "GET" }).handler(async () => {
  const [settings, storeTypes] = await Promise.all([getStoreSettings(), getStoreTypes()]);
  return storeTypes.some((type) => type.key === settings.productType)
    ? settings.productType
    : (storeTypes[0]?.key ?? null);
});

export const Route = createFileRoute("/$locale/")({
  loader: async ({ params }) => {
    const target = await getDefaultBoutique();
    // No boutique exists at all yet — nothing to redirect to.
    if (target) redirect({ href: `/${target}`, locale: params.locale });
  },
  component: () => null,
});
