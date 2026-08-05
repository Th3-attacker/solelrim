import { headers } from "next/headers";
import { getStoreTypeRouting } from "@/lib/shop/domain-cache";

// "" when this request arrived on the boutique's own bound custom domain —
// proxy.ts already injects the [storeType] segment server-side for those,
// so internal links must not add a second, visible one back. "/{storeType}"
// otherwise, since the platform's shared/default domain still needs it to
// tell boutiques apart.
export async function getStorefrontBasePath(storeType: string): Promise<string> {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0] ?? "";
  const { domainMap } = await getStoreTypeRouting();
  return domainMap.get(host) === storeType ? "" : `/${storeType}`;
}
