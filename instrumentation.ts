import * as Sentry from "@sentry/nextjs";

// Node.js and Edge each need their own Sentry.init() call — they run in
// different runtimes with different transports, and Next.js loads this
// file once per runtime, gated by NEXT_RUNTIME.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Error tracking only for now — no performance/tracing quota spent
      // until it's actually wanted.
      tracesSampleRate: 0,
    });
  }
}

// Forwards server-side rendering/Server Action/Route Handler errors that
// Next.js itself catches (the ones that never reach a try/catch in our own
// code) to Sentry, with the route and request context attached.
export const onRequestError = Sentry.captureRequestError;
