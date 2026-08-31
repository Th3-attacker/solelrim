import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// A bare "unknown" fallback would put every request missing both proxy
// headers (misconfiguration, or direct/local access) into one shared
// bucket — either it locks every such visitor out together once one of
// them trips the limit, or worse, an attacker who can suppress both
// headers gets a limiter that no longer discriminates them from anyone
// else. Falling back to a hash of whatever else is available (user-agent +
// accept-language) keeps distinct visitors in distinct buckets even
// without a real IP; only a request missing every one of these signals —
// vanishingly rare for a real browser — collapses to the literal
// "unknown" bucket.
//
// SECURITY NOTE: none of these headers are trustworthy unless the hosting
// platform sets/overwrites them at its edge (Vercel does for x-forwarded-for;
// a self-host behind a misconfigured proxy, or one reachable directly, does
// not). Where they aren't, the leftmost x-forwarded-for is attacker-chosen
// and the user-agent fallback hands out a fresh bucket per UA string. If
// this ever runs somewhere without a trusted edge, switch to a
// platform-verified client address (e.g. @vercel/functions `ipAddress()`).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  // x-real-ip first: a single value the edge sets, harder to prepend to than
  // the comma-list x-forwarded-for whose leftmost entry is the classic spoof.
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const fingerprint = [h.get("user-agent"), h.get("accept-language")]
    .filter(Boolean)
    .join("|");
  if (!fingerprint) return "unknown";
  return `unknown:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 16)}`;
}

// Sliding-window counter backed by RateLimitHit: prunes hits older than the
// window, counts what's left for `key`, and records this call as a new hit
// if under `max`. Good enough for deterring casual abuse on a low-traffic
// storefront — not meant to hold up under a distributed attack.
export async function checkRateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  return prisma.$transaction(async (tx) => {
    // Serialize concurrent checks for the same key so the count-then-create
    // below is effectively atomic. Without it, a burst of concurrent
    // requests all read a count under `max` before any of them insert, and
    // the real ceiling becomes max + concurrency. A transaction-scoped
    // advisory lock auto-releases on commit/rollback (safe with the
    // transaction-mode connection pooler). hashtext collisions just mean two
    // unrelated keys occasionally share a lock — harmless over-serialization.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

    await tx.rateLimitHit.deleteMany({
      where: { key, createdAt: { lt: windowStart } },
    });
    const count = await tx.rateLimitHit.count({
      where: { key, createdAt: { gte: windowStart } },
    });
    if (count >= max) return false;

    await tx.rateLimitHit.create({ data: { key } });

    // Opportunistic global GC: the per-key prune above never revisits a key
    // that stopped being hit (a rotated IP, a one-off user-agent bucket), so
    // the table would only grow. ~2% of allowed calls sweep everything older
    // than an hour — comfortably past the longest window any caller uses.
    if (Math.random() < 0.02) {
      await tx.rateLimitHit.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 3_600_000) } },
      });
    }

    return true;
  });
}
