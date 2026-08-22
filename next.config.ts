import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// Sentry's browser SDK posts error events straight to the DSN's ingest
// host — CSP's connect-src would silently swallow every one of them
// otherwise. Derived from the DSN itself (not hardcoded) so a DSN
// rotation doesn't also require remembering to update this.
const sentryIngestHost = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).host
  : null;

// No nonce/strict-dynamic here on purpose: several components set inline
// `style` (color swatches whose color comes from admin-entered variant
// data, the checkout sheet's keyboard-avoidance offset) which CSP's
// style-src-attr can't allow via nonce — only 'unsafe-inline' or
// per-attribute hashes, and hashing every dynamic value isn't practical.
// Next's own bootstrap/hydration script is inline too, same story for
// script-src. Still meaningfully tightens everything else (frame-ancestors,
// object-src, connect/img-src scoped to Supabase, no other third party).
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co;
  font-src 'self';
  connect-src 'self' https://*.supabase.co${sentryIngestHost ? ` https://${sentryIngestHost}` : ""};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // Pin the project root explicitly — Turbopack otherwise walks up looking
  // for a lockfile and picks up an unrelated one in the parent home
  // directory, misdetecting the workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
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
          { key: "Content-Security-Policy", value: cspHeader },
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
    ];
  },
};

// Deliberately not wrapped in withSentryConfig: that plugin's only jobs
// beyond what instrumentation.ts/instrumentation-client.ts already do are
// source-map upload (needs a SENTRY_AUTH_TOKEN we don't have yet) and
// build-time webpack/turbopack tree-shaking — neither is required for
// error capture to work, and skipping it keeps the build pipeline
// untouched. Revisit if source-mapped stack traces become worth the setup.
export default withNextIntl(nextConfig);
