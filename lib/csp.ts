// The Content-Security-Policy of every page. proxy.ts sends it with a fresh
// nonce per request: Next.js puts that nonce on its own scripts (it reads the
// policy from the request), the layouts on theirs (next-themes, the forced
// color mode), and 'strict-dynamic' lets those load their chunks. A script
// injected into a page has no nonce and doesn't run.
//
// Styles keep 'unsafe-inline': inline `style` attributes (color swatches from
// admin-entered data, the checkout sheet's keyboard offset) can't carry a
// nonce, and a style can't run code.
export function contentSecurityPolicy({
  nonce,
  extraScriptSources = [],
  isDev = process.env.NODE_ENV === "development",
}: {
  // Without one (responses the proxy doesn't see), inline scripts are allowed.
  nonce?: string;
  extraScriptSources?: string[];
  isDev?: boolean;
}): string {
  // Sentry's browser SDK posts straight to the DSN's ingest host.
  const sentryIngestHost = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).host
    : null;
  const scriptSources = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : ["'unsafe-inline'"]),
    // React rebuilds server error stacks with eval in development only.
    ...(isDev ? ["'unsafe-eval'"] : []),
    ...extraScriptSources,
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${sentryIngestHost ? ` https://${sentryIngestHost}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// A nonce per response: 16 random bytes, base64.
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
