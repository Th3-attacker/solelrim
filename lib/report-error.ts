import { captureException } from "@sentry/core";

// For a failure the code catches and lives with (a push that couldn't go out,
// a cache refresh that failed, an audit line that couldn't be written): still
// logged, and sent to Sentry, where a console line alone never shows up.
// @sentry/core rather than @sentry/nextjs: the same client the Next.js build
// initializes (instrumentation.ts), and nothing tying this file to Next.js
// for the TanStack Start build.
export function reportError(where: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(`[${where}]`, error, ...(extra ? [extra] : []));
  captureException(error, { tags: { where }, ...(extra ? { extra } : {}) });
}
