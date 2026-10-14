import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";
import { SECURITY_HEADERS } from "@/lib/security-headers";
import { isCrossSiteWrite } from "~/server/request-guard";

// Every request (pages, server functions, server routes): refuses cross-site
// writes, then sends the security headers and a Content-Security-Policy with
// a fresh nonce. The router puts that nonce on the scripts it renders
// (src/router.tsx); a script injected into the page has none and won't run.
const securityMiddleware = createMiddleware().server(({ request, next }) => {
  const headers = request.headers;
  if (
    isCrossSiteWrite({
      method: request.method,
      origin: headers.get("origin"),
      host: headers.get("x-forwarded-host") ?? headers.get("host"),
    })
  ) {
    return new Response("Cross-site request refused", { status: 403 });
  }

  const nonce = newNonce();
  for (const { key, value } of SECURITY_HEADERS) setResponseHeader(key, value);
  setResponseHeader("Content-Security-Policy", contentSecurityPolicy({ nonce }));
  return next({ context: { nonce } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware],
}));
