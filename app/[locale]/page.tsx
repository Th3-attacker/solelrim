import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";

// "/" has no boutique of its own — it always redirects to the default one
// (StoreSettings.productType), falling back to the first StoreType if that
// pointer is somehow stale (e.g. its boutique was since deleted).
export default async function RootPage() {
  const [locale, settings, storeTypes] = await Promise.all([
    getLocale(),
    getStoreSettings(),
    getStoreTypes(),
  ]);

  const target = storeTypes.some((type) => type.key === settings.productType)
    ? settings.productType
    : storeTypes[0]?.key;

  if (!target) {
    // No boutique exists at all yet — nothing to redirect to.
    return null;
  }

  redirect({ href: `/${target}`, locale });
}
