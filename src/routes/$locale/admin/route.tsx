import { Outlet, createFileRoute } from "@tanstack/react-router";

// The admin is kept out of search results, even when linked from elsewhere.
export const Route = createFileRoute("/$locale/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "SOLAL Admin" }],
  }),
  component: Outlet,
});
