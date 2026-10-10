// GET /api/v1/docs — the interactive reference of this API (Scalar), read
// from /api/v1/openapi.json on the same deployment so "Test request" calls
// that deployment. Nothing to install: the viewer comes from jsDelivr, pinned
// and checked with SRI; next.config.ts gives this one path a CSP that lets
// that script in. Scalar's fonts, telemetry and request proxy are turned off,
// and connect-src stays 'self'.

const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.69.2/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-WIChsUVC1uJ+G1lFA6lPYzOUgXAe8dVxUFIZ7lcENNtV34Esuo81NIxsj8EAQeHB";

// The site's look: system UI font, neutral greys, 0.625rem radius.
const CUSTOM_CSS = `
.scalar-app, .scalar-api-reference {
  --scalar-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --scalar-font-code: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --scalar-radius: 0.375rem;
  --scalar-radius-lg: 0.625rem;
  --scalar-radius-xl: 0.875rem;
}
.light-mode {
  --scalar-background-1: #ffffff;
  --scalar-background-2: #f7f7f7;
  --scalar-background-3: #efefef;
  --scalar-border-color: #e5e5e5;
  --scalar-color-1: #171717;
  --scalar-color-2: #525252;
  --scalar-color-3: #8a8a8a;
  --scalar-color-accent: #171717;
  --scalar-background-accent: #f2f2f2;
}
.dark-mode {
  --scalar-background-1: #0f0f0f;
  --scalar-background-2: #1a1a1a;
  --scalar-background-3: #262626;
  --scalar-border-color: #2e2e2e;
  --scalar-color-1: #fafafa;
  --scalar-color-2: #b5b5b5;
  --scalar-color-3: #7a7a7a;
  --scalar-color-accent: #fafafa;
  --scalar-background-accent: #262626;
}
`;

const CONFIG = {
  url: "/api/v1/openapi.json",
  theme: "default",
  customCss: CUSTOM_CSS,
  layout: "modern",
  withDefaultFonts: false,
  telemetry: false,
  proxyUrl: "",
  agent: { disabled: true },
  mcp: { disabled: true },
  showDeveloperTools: "never",
  hideClientButton: true,
  documentDownloadType: "json",
  defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  metaData: { title: "SOLAL API v1" },
};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>SOLAL API v1</title>
<link rel="icon" href="/favicon.ico">
</head>
<body>
<div id="app"></div>
<script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
<script>Scalar.createApiReference("#app", ${JSON.stringify(CONFIG)});</script>
</body>
</html>`;

export function GET() {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=300" },
  });
}
