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
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp;

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

  await prisma.rateLimitHit.deleteMany({
    where: { key, createdAt: { lt: windowStart } },
  });
  const count = await prisma.rateLimitHit.count({
    where: { key, createdAt: { gte: windowStart } },
  });
  if (count >= max) return false;

  await prisma.rateLimitHit.create({ data: { key } });
  return true;
}
