import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";

// The storefront's reads (boutique settings, categories, catalogue) cached
// across requests, so a visit no longer costs a round of database queries.
// Every write that changes what a storefront shows already goes through
// lib/revalidate.ts, which expires the tag below at once; the time limit is
// only a safety net. Stock stays trustworthy either way: placing an order
// re-checks it atomically in the database, whatever a cached page showed.
//
// unstable_cache rather than `"use cache"`: the directive needs
// `cacheComponents`, which changes how every route of the app renders
// (prerendered shells, <Activity> navigation, Suspense requirements). The tag
// works the same with both, so moving later only changes this file.
export const SHOP_DATA_TAG = "shop-data";
// Court : ce cache est propre à chaque instance du serveur (src/compat/next/cache.ts),
// une écriture n'expire que celui de l'instance qui l'a faite.
const SAFETY_NET_SECONDS = 30;

// The cache stores JSON: Prisma's Decimal and Date would come back as
// strings, and the code calls .toNumber() and getTime() on them. Tagged on
// the way in, restored on the way out, so callers get the same types as an
// uncached query.
export function encodeCached(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key, encoded) {
    const raw = this[key];
    if (raw instanceof Date) return { $date: raw.toISOString() };
    if (Prisma.Decimal.isDecimal(raw)) return { $decimal: raw.toString() };
    return encoded;
  });
}

export function decodeCached<T>(text: string): T {
  return JSON.parse(text, (_key, value) => {
    if (value && typeof value === "object") {
      if (typeof value.$date === "string") return new Date(value.$date);
      if (typeof value.$decimal === "string") return new Prisma.Decimal(value.$decimal);
    }
    return value;
  }) as T;
}

export function cachedShopQuery<Args extends unknown[], Result>(
  name: string,
  query: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  let cached: ((...args: Args) => Promise<string>) | undefined;
  return async (...args: Args) => {
    // Unit tests run outside the server, where there is no cache to read.
    if (process.env.VITEST) return query(...args);
    cached ??= unstable_cache(
      async (...inner: Args) => encodeCached(await query(...inner)),
      [name],
      {
        tags: [SHOP_DATA_TAG],
        revalidate: SAFETY_NET_SECONDS,
      },
    );
    return decodeCached<Result>(await cached(...args));
  };
}
