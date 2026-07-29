// No canonical domain was configured anywhere in the project — sitemap.ts
// and robots.ts both need one as an absolute URL. Prefers an explicit
// NEXT_PUBLIC_SITE_URL, falls back to Vercel's own production domain env
// var (no protocol prefix), then to localhost for local dev.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
