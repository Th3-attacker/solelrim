import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";
import { NotFound } from "./components/not-found";

// The CSP nonce of the page being rendered (src/start.ts). Only the server
// needs it: the browser runs the scripts already in the page.
const getNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(() => undefined);

// One router and one query cache per request on the server, one for the
// whole visit in the browser.
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data shown less than 30 s ago is shown again at once, without a
        // request; older data is shown too, and refreshed behind it.
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // A link's page starts loading as soon as the pointer rests on it.
    defaultPreload: "intent",
    // Freshness is the query cache's call, not the router's.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    ssr: { nonce: getNonce() },
  });

  // Queries filled on the server travel to the browser with the page.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
