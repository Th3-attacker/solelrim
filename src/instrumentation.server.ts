import "server-only";
import * as Sentry from "@sentry/tanstackstart-react";
import { serverEnv } from "@/lib/env";
import { expectedErrorCode } from "@/lib/errors";

// Fail at startup, with the names, rather than on the first request that
// needs a missing variable (lib/env.ts).
serverEnv();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Low, fixed sample rate for performance tracing — enough signal to
  // spot slow requests on a low-traffic storefront without spending
  // much of Sentry's quota. Bump if traffic grows and headroom allows.
  tracesSampleRate: 0.1,
  // A refusal thrown on purpose (no session, wrong role, a blocked
  // boutique, see lib/errors.ts) is not a bug to look into.
  beforeSend: (event, hint) => (expectedErrorCode(hint.originalException) ? null : event),
});
