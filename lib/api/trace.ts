import { fail } from "@/lib/api/http";

// Wraps every /api/v1 handler: one log line per request with the app's
// X-Request-Id, X-App-Version and X-App-Platform, the request id sent back
// in the response (so a customer's error report can be matched to the log),
// and the optional minimum app version.
//
// APP_MIN_VERSION (e.g. "1.4.0", unset by default): an app that says it is
// older gets 426 { error: "appUpdateRequired" }. An app that sends no
// version is let through — versions installed before the header existed
// wouldn't understand the 426 anyway.

const REQUEST_ID = /^[\w.:-]{1,128}$/;

function parseVersion(value: string): number[] | null {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

export function isBelowVersion(version: string, minimum: string): boolean {
  const have = parseVersion(version);
  const need = parseVersion(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== need[i]) return have[i] < need[i];
  }
  return false;
}

// Header values end up in a log line: kept short and printable.
function clean(value: string | null): string | null {
  return value ? value.replace(/[^\x20-\x7e]/g, "").slice(0, 64) || null : null;
}

export function withApi<C>(handler: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const started = Date.now();
    const sent = request.headers.get("x-request-id");
    const requestId = sent && REQUEST_ID.test(sent) ? sent : crypto.randomUUID();
    const appVersion = clean(request.headers.get("x-app-version"));
    const appPlatform = clean(request.headers.get("x-app-platform"));

    const log = (status: number) =>
      console.info(
        JSON.stringify({
          api: "v1",
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          status,
          ms: Date.now() - started,
          appVersion,
          appPlatform,
        }),
      );

    const minimum = process.env.APP_MIN_VERSION?.trim();
    let response: Response;
    try {
      response =
        minimum && appVersion && isBelowVersion(appVersion, minimum)
          ? fail("appUpdateRequired", 426)
          : await handler(request, ctx);
    } catch (error) {
      // Logged with the request id, then rethrown so Next answers it and
      // reports it to Sentry (instrumentation.ts) as before.
      log(500);
      throw error;
    }
    response.headers.set("X-Request-Id", requestId);
    log(response.status);
    return response;
  };
}
