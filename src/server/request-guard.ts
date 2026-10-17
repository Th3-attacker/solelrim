// A write sent by another site (CSRF): the browser names the page that sent
// it in Origin, and it isn't this host. The session cookies are already
// SameSite=Lax; this also covers a sibling subdomain, which Lax lets through.
// No Origin at all is let through: browsers always send it on a cross-site
// POST, and the mobile app's API calls carry none.
export function isCrossSiteWrite({
  method,
  origin,
  host,
}: {
  method: string;
  origin: string | null;
  host: string | null;
}): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (!origin) return false;
  if (!host) return true;
  try {
    return new URL(origin).host !== host.toLowerCase();
  } catch {
    // "null" (sandboxed frames, some redirects) or garbage.
    return true;
  }
}
