import { redirect, type ParsedLocation } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { Locale } from "~/i18n/config";
import { ADMIN_LOGIN, adminRedirect } from "~/server/admin-access";
import { adminSessionQuery } from "./auth.queries";

// Run before every admin page loads: sends the visitor where the routing
// rules say (admin-access.ts), or hands the page the signed-in admin.
export async function guardAdminPage({
  queryClient,
  locale,
  location,
}: {
  queryClient: QueryClient;
  locale: Locale;
  location: ParsedLocation;
}) {
  const session = await queryClient.fetchQuery(adminSessionQuery);
  // "/fr/admin/orders/" → "/admin/orders"
  const path = location.pathname.slice(locale.length + 1).replace(/\/+$/, "") || "/";
  const target = adminRedirect(session, path);
  if (target) throw redirect({ href: `/${locale}${target}`, replace: true });
  return session;
}

// For the pages behind the login: the admin they're shown to.
export async function guardSignedInAdmin(args: Parameters<typeof guardAdminPage>[0]) {
  const session = await guardAdminPage(args);
  if (session.status !== "signedIn") {
    throw redirect({ href: `/${args.locale}${ADMIN_LOGIN}`, replace: true });
  }
  return { admin: session.admin };
}
