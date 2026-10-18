// Les en-têtes de sécurité de toutes les réponses (ex-headers() de
// next.config.ts). La Content-Security-Policy n'en fait pas partie : celle des
// pages porte un nonce propre à chaque requête (src/start.ts, lib/csp.ts).
export function securityHeaders(): Record<string, string> {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}
