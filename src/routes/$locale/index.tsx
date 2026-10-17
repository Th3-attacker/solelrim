import { createFileRoute, redirect } from "@tanstack/react-router";

// Until the storefront moves to this build (step 8), a language's home is
// the admin.
export const Route = createFileRoute("/$locale/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$locale/admin", params });
  },
});
