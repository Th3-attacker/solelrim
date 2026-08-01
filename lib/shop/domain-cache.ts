import { prisma } from "@/lib/prisma";

// proxy.ts needs a fast host -> boutique-key lookup on every request. It
// runs outside React's render context (no access to the request-scoped
// cache() wrappers in lib/queries/settings.ts), so this is a plain
// module-scope cache instead: short TTL, refreshed lazily, with an
// in-flight promise so a burst of concurrent requests at TTL expiry doesn't
// fire N duplicate queries. Vercel's Node.js runtime reuses warm instances,
// so this is a meaningful (if per-instance, not global) cut in DB load —
// but it's a soft optimization only, never a source of truth: a query
// failure always degrades to "no custom domain matched" (see fetchRouting),
// since this lookup runs on every locale-prefixed request, not just /admin.
const TTL_MS = 60_000;

type Routing = { domainMap: Map<string, string>; keySet: Set<string> };

let cached: Routing | null = null;
let expiresAt = 0;
let inFlight: Promise<Routing> | null = null;

async function fetchRouting(): Promise<Routing> {
  try {
    const storeTypes = await prisma.storeType.findMany({
      select: { key: true, domain: true },
    });
    const domainMap = new Map<string, string>();
    const keySet = new Set<string>();
    for (const storeType of storeTypes) {
      keySet.add(storeType.key);
      if (storeType.domain) domainMap.set(storeType.domain, storeType.key);
    }
    return { domainMap, keySet };
  } catch (err) {
    console.error("[domain-cache] fetchRouting failed", err);
    // A DB blip must only disable the custom-domain feature for this warm
    // instance, never take down the rest of the site. Fall back to
    // whatever we last knew (even if stale) rather than an empty map, so a
    // transient error doesn't briefly break a domain that was working.
    return cached ?? { domainMap: new Map(), keySet: new Set() };
  }
}

export async function getStoreTypeRouting(): Promise<Routing> {
  if (cached && Date.now() < expiresAt) {
    return cached;
  }
  if (inFlight) {
    return inFlight;
  }
  inFlight = fetchRouting()
    .then((routing) => {
      cached = routing;
      expiresAt = Date.now() + TTL_MS;
      return routing;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
