"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { expectedErrorCode } from "@/lib/errors";

// For an error.tsx boundary: logs the error and sends it to Sentry, unless the
// server already did (the error then carries a digest, see instrumentation.ts)
// or it's a refusal thrown on purpose (lib/errors.ts). Returns the reference
// worth showing so the person can quote it: the server's digest.
export function useReportedError(error: Error & { digest?: string }): string | null {
  const expected = expectedErrorCode(error) !== null;

  useEffect(() => {
    console.error(error);
    if (!error.digest && !expected) Sentry.captureException(error);
  }, [error, expected]);

  return expected ? null : (error.digest ?? null);
}
