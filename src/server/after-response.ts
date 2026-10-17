import { getRequest } from "@tanstack/react-start/server";
import { reportError } from "@/lib/report-error";

// Work that shouldn't hold the response back (a push to the customer, the
// live refresh of open dashboards): started now, awaited by the platform
// after the response (Vercel's waitUntil, which Nitro puts on the request).
// A plain Node server simply keeps running it. A failure is reported, never
// thrown at the caller.
export function afterResponse(where: string, task: () => Promise<unknown>): void {
  const request = getRequest() as Request & { waitUntil?: (promise: Promise<unknown>) => void };
  const running = Promise.resolve()
    .then(task)
    .catch((error: unknown) => reportError(where, error));
  request.waitUntil?.(running);
}
