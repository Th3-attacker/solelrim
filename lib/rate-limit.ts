import "server-only";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/client-ip";

// The Next.js side of the rate limiter (lib/rate-limit-store.ts): the same
// functions, plus the client address read from the current request.
export * from "@/lib/rate-limit-store";

export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}
