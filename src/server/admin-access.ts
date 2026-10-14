// Who may open which admin page: the routing rules of proxy.ts, for the
// TanStack Start build. Routing only — every server function still checks
// the caller itself (src/server/session.server.ts).

export type AdminRole = "SUPERADMIN" | "BOUTIQUE_ADMIN" | "SELLER";

export type AdminSession =
  | { status: "signedOut" }
  // Password accepted, the 2FA code not yet.
  | { status: "mfaPending" }
  | {
      status: "signedIn";
      admin: { id: string; email: string; role: AdminRole };
      // A superadmin required 2FA for this admin, who has no factor yet.
      mfaSetupRequired: boolean;
    };

// Paths without the language: "/admin", "/admin/orders"…
export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";
export const ADMIN_SETTINGS = "/admin/settings";
export const SELLER_HOME = "/admin/pos";

// The only admin areas a seller may open: the checkout and everything under
// it (receipts, cash closing), and the help page.
function isSellerPath(path: string) {
  return path === SELLER_HOME || path.startsWith(`${SELLER_HOME}/`) || path === "/admin/help";
}

// Where to send this session instead of `path`, or null to let it through.
export function adminRedirect(session: AdminSession, path: string): string | null {
  const onLogin = path === ADMIN_LOGIN;

  if (session.status !== "signedIn") return onLogin ? null : ADMIN_LOGIN;
  if (onLogin) return session.admin.role === "SELLER" ? SELLER_HOME : ADMIN_HOME;

  const { admin, mfaSetupRequired } = session;
  if (admin.role === "SELLER") return isSellerPath(path) ? null : SELLER_HOME;
  // Settings is where the factor gets enrolled; nothing else opens until then.
  if (mfaSetupRequired && path !== ADMIN_SETTINGS) return ADMIN_SETTINGS;
  return null;
}
