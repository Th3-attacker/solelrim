import * as Sentry from "@sentry/nextjs";

// Node.js and Edge each need their own Sentry.init() call — they run in
// different runtimes with different transports, and Next.js loads this
// file once per runtime, gated by NEXT_RUNTIME.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Low, fixed sample rate for performance tracing — enough signal to
      // spot slow requests on a low-traffic storefront without spending
      // much of Sentry's quota. Bump if traffic grows and headroom allows.
      tracesSampleRate: 0.1,
    });
  }
}

// Forwards server-side rendering/Server Action/Route Handler errors that
// Next.js itself catches (the ones that never reach a try/catch in our own
// code) to Sentry, with the route and request context attached.
export const onRequestError = Sentry.captureRequestError;
