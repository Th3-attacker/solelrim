import { Outlet, createFileRoute } from "@tanstack/react-router";
import { guardSignedInAdmin } from "~/features/auth/guard";

// Every page behind the login. The sidebar, header and mobile tab bar of the
// design come here in step 1.
export const Route = createFileRoute("/$locale/admin/_dashboard")({
  beforeLoad: ({ context, location }) =>
    guardSignedInAdmin({ queryClient: context.queryClient, locale: context.locale, location }),
  component: Outlet,
});
