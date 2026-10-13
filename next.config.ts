import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import { contentSecurityPolicy } from "./lib/csp";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Pages get their Content-Security-Policy, with a nonce, from proxy.ts
// (lib/csp.ts). This one is for the API, which the proxy's matcher skips:
// the same policy, without a nonce.
const cspHeader = contentSecurityPolicy({});

// /api/v1/docs (app/api/v1/docs/route.ts) loads the Scalar API reference
// from jsDelivr, pinned and SRI-checked. Same policy otherwise: it only
// talks to its own deployment.
const apiDocsCspHeader = contentSecurityPolicy({ extraScriptSources: ["https://cdn.jsdelivr.net"] });

const nextConfig: NextConfig = {
  // Pin the project root explicitly — Turbopack otherwise walks up looking
  // for a lockfile and picks up an unrelated one in the parent home
  // directory, misdetecting the workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
  // Drop the framework-fingerprinting `X-Powered-By: Next.js` response header
  // — no functional value, just tells an attacker what to look for.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // This is a global ceiling on every Server Action's whole multipart
      // body, not per-field — every image-upload action (products, wallet
      // logos, branding, payment screenshots) validates its own file
      // against MAX_IMAGE_BYTES (5MB, lib/shop/image-signature.ts), so this
      // needs enough headroom above that for the upload to ever reach that
      // check instead of being rejected by the framework first with a
      // generic "body too large" error.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      // Pages get theirs from proxy.ts; the API, which the proxy skips, here.
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: cspHeader }],
      },
      // Listed last so its CSP overrides the one above.
      {
        source: "/api/v1/docs",
        headers: [{ key: "Content-Security-Policy", value: apiDocsCspHeader }],
      },
    ];
  },
};

// Error capture itself lives in instrumentation.ts/instrumentation-client.ts.
// withSentryConfig only adds the source-map upload after `next build`, so
// browser stack traces in Sentry point at our code instead of minified
// chunks. It needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT (Vercel
// env); without the token the build is exactly what it was.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(withNextIntl(nextConfig), {
      silent: !process.env.CI,
      // The maps are uploaded, then removed from the deployment: Sentry has
      // them, the public doesn't.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : withNextIntl(nextConfig);
