import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
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
