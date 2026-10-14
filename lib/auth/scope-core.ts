import { DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";

// Which boutique a superadmin is acting on, free of any framework: the
// Next.js build (lib/auth/scope.ts) and the TanStack Start one each read the
// cookie their own way and pass it in.
export const ADMIN_SCOPE_COOKIE = "admin_store_scope";

// The boutique they picked (cookie) if it still exists, else the one live
// on the site, else the first one. The live one is only read when needed.
export async function resolveSuperAdminScope({
  requested,
  storeTypeKeys,
  liveProductType,
}: {
  requested: string | undefined;
  storeTypeKeys: readonly string[];
  liveProductType: () => Promise<string>;
}): Promise<string> {
  if (requested && storeTypeKeys.includes(requested)) return requested;
  const live = await liveProductType();
  if (storeTypeKeys.includes(live)) return live;
  return storeTypeKeys[0] ?? DEFAULT_PRODUCT_TYPE;
}
