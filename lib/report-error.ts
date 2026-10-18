import * as Sentry from "@sentry/tanstackstart-react";

// For a failure the code catches and lives with (a push that couldn't go out,
// a cache refresh that failed, an audit line that couldn't be written): still
// logged, and sent to Sentry, where a console line alone never shows up.
export function reportError(where: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(`[${where}]`, error, ...(extra ? [extra] : []));
  Sentry.captureException(error, { tags: { where }, ...(extra ? { extra } : {}) });
}
