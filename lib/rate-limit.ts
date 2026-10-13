import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Every budget in one place. Mauritanian carriers put thousands of phones
// behind one public address (carrier-grade NAT), so a per-IP budget can only
// be a safety net against a flood from one machine, sized for a whole
// carrier's customers at once; the budget that actually holds one person back
// is keyed by what the request carries: a phone number, an account.
export const RATE_LIMITS = {
  // Placing an order (an upload): the phone is required and checked once the
  // form is parsed.
  orderPerIp: { windowMs: HOUR, max: 120 },
  orderPerPhone: { windowMs: HOUR, max: 5 },
  // Header search, live as the customer types (debounced). The leading
  // wildcard can't use an index, so it stays bounded.
  searchPerIp: { windowMs: MINUTE, max: 120 },
  // The cart's stock check when it opens, and opening a shared cart link.
  stocksPerIp: { windowMs: MINUTE, max: 120 },
  sharedCartPerIp: { windowMs: MINUTE, max: 60 },
  // Promo code preview: guessing codes is held back per phone.
  promoPerIp: { windowMs: 15 * MINUTE, max: 120 },
  promoPerPhone: { windowMs: 15 * MINUTE, max: 10 },
  // Tracking an order tells guessing from following one. Failed lookups
  // (unknown pair, malformed phone or reference) are held tight per phone,
  // so one customer's references can't be guessed even from many addresses,
  // and looser per IP, where every customer's typos add up. Successes are
  // counted per order (only a runaway loop reaches it); every lookup per IP
  // is the burst safety net.
  trackFailurePerPhone: { windowMs: 15 * MINUTE, max: 10 },
  trackFailurePerIp: { windowMs: 15 * MINUTE, max: 60 },
  trackSuccessPerOrder: { windowMs: MINUTE, max: 30 },
  trackPerIp: { windowMs: MINUTE, max: 300 },
  // The app asking for pushes on an order (phone + reference checked).
  pushPerIp: { windowMs: HOUR, max: 600 },
  // Admin sign-in: per account, so guessing one password or one 2FA code
  // from many addresses stops too; per IP a little looser.
  loginPerIp: { windowMs: 15 * MINUTE, max: 30 },
  loginPerEmail: { windowMs: 15 * MINUTE, max: 10 },
  mfaPerIp: { windowMs: 15 * MINUTE, max: 30 },
  mfaPerUser: { windowMs: 15 * MINUTE, max: 10 },
} satisfies Record<string, { windowMs: number; max: number }>;

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
  limit: { windowMs: number; max: number },
): Promise<boolean> {
  return (await rateLimitRetryAfter(key, limit)) === null;
}

// Same check, but tells a blocked caller how long to wait: null when the call
// is allowed, otherwise the seconds until the oldest hit leaves the window
// (what the mobile API sends back as Retry-After).
export async function rateLimitRetryAfter(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): Promise<number | null> {
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
    if (count >= max) {
      return secondsUntilFree(tx, key, { windowMs, max }, count);
    }

    await tx.rateLimitHit.create({ data: { key } });

    // Opportunistic global GC: the per-key prune above never revisits a key
    // that stopped being hit (a rotated IP, a one-off user-agent bucket), so
    // the table would only grow. ~2% of allowed calls sweep everything older
    // than two hours — comfortably past the longest window any caller uses
    // (one hour).
    if (Math.random() < 0.02) {
      await tx.rateLimitHit.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 2 * 3_600_000) } },
      });
    }

    return null;
  });
}

type HitStore = Pick<typeof prisma, "rateLimitHit">;

// Seconds until `key` is back under `max`. The hit that has to leave the
// window is the (count - max + 1)-th oldest: the oldest alone when the count
// sits at the limit, a later one when concurrent calls went past it.
async function secondsUntilFree(
  db: HitStore,
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
  count: number,
): Promise<number> {
  const blocking = await db.rateLimitHit.findFirst({
    where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } },
    orderBy: { createdAt: "asc" },
    skip: count - max,
    select: { createdAt: true },
  });
  const freeAt = (blocking?.createdAt.getTime() ?? Date.now()) + windowMs;
  return Math.max(1, Math.ceil((freeAt - Date.now()) / 1000));
}

// For limits that only count some outcomes (failed lookups): check first
// without recording anything, and record with recordRateLimitHit once the
// outcome is known. No lock: calls running side by side may go a few hits
// past `max`, as many as run at once — fine for a deterrent.
export async function peekRateLimit(
  key: string,
  limit: { windowMs: number; max: number },
): Promise<number | null> {
  const count = await prisma.rateLimitHit.count({
    where: { key, createdAt: { gte: new Date(Date.now() - limit.windowMs) } },
  });
  return count >= limit.max ? secondsUntilFree(prisma, key, limit, count) : null;
}

export async function recordRateLimitHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } });
}
