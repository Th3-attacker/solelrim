import * as Sentry from "@sentry/nextjs";

// Runs before hydration on every page load (see Next.js's
// instrumentation-client.{js,ts} convention) — catches browser-side
// crashes: a checkout step throwing on a customer's phone, an admin
// action failing silently, anything that currently only surfaces if the
// person hits it tells us on WhatsApp.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
});
