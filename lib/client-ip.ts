import "server-only";
import { createHash } from "node:crypto";

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
export function clientIpFromHeaders(h: { get(name: string): string | null }): string {
  // x-real-ip first: a single value the edge sets, harder to prepend to than
  // the comma-list x-forwarded-for whose leftmost entry is the classic spoof.
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const fingerprint = [h.get("user-agent"), h.get("accept-language")].filter(Boolean).join("|");
  if (!fingerprint) return "unknown";
  return `unknown:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 16)}`;
}
