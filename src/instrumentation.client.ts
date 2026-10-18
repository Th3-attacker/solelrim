import * as Sentry from "@sentry/tanstackstart-react";
import { expectedErrorCode } from "@/lib/errors";

// Runs before hydration on every page load — catches browser-side
// crashes: a checkout step throwing on a customer's phone, an admin
// action failing silently, anything that currently only surfaces if the
// person hits it tells us on WhatsApp.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Vercel's own environment (production / preview / development), like the
  // server side: NODE_ENV is "production" on preview deployments too, which
  // mixed staging's errors in with production's.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Mirrors the server-side rate — same low, fixed sample for browser-side
  // performance tracing.
  tracesSampleRate: 0.1,
  beforeSend: (event, hint) => (expectedErrorCode(hint.originalException) ? null : event),
});
