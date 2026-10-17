// Refusals the server throws on purpose (no session, wrong role, a boutique
// whose license blocks writes), as opposed to bugs. Next.js replaces a thrown
// error's message with a generic one in production but keeps a `digest` the
// error already carries, so the code travels in `digest`: the error boundary
// can still tell "your boutique is suspended" from a crash, and Sentry can
// leave these out.
export const EXPECTED_ERROR_CODES = ["unauthorized", "forbidden", "licenseBlocked"] as const;

export type ExpectedErrorCode = (typeof EXPECTED_ERROR_CODES)[number];

export class ExpectedError extends Error {
  readonly digest: ExpectedErrorCode;

  constructor(code: ExpectedErrorCode) {
    super(code);
    this.name = "ExpectedError";
    this.digest = code;
  }
}

// The code of an error that is one of these refusals, whichever side of the
// network it's read on (the digest in production, the message in dev).
export function expectedErrorCode(error: unknown): ExpectedErrorCode | null {
  if (!(error instanceof Error)) return null;
  const { digest } = error as Error & { digest?: unknown };
  const codes: readonly unknown[] = EXPECTED_ERROR_CODES;
  if (codes.includes(digest)) return digest as ExpectedErrorCode;
  if (codes.includes(error.message)) return error.message as ExpectedErrorCode;
  return null;
}
