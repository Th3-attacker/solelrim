import { describe, expect, it } from "vitest";
import { adminRedirect, type AdminRole, type AdminSession } from "./admin-access";

function signedIn(role: AdminRole, mfaSetupRequired = false): AdminSession {
  return {
    status: "signedIn",
    admin: { id: "a1", email: "e@example.com", role },
    mfaSetupRequired,
  };
}

describe("adminRedirect", () => {
  it("sends a signed-out visitor to the login page, and leaves them there", () => {
    expect(adminRedirect({ status: "signedOut" }, "/admin/orders")).toBe("/admin/login");
    expect(adminRedirect({ status: "signedOut" }, "/admin/login")).toBeNull();
  });

  it("keeps an admin whose 2FA code is pending on the login page", () => {
    expect(adminRedirect({ status: "mfaPending" }, "/admin")).toBe("/admin/login");
    expect(adminRedirect({ status: "mfaPending" }, "/admin/login")).toBeNull();
  });

  it("takes a signed-in admin off the login page", () => {
    expect(adminRedirect(signedIn("SUPERADMIN"), "/admin/login")).toBe("/admin");
    expect(adminRedirect(signedIn("SELLER"), "/admin/login")).toBe("/admin/pos");
  });

  it("lets an admin open any admin page", () => {
    expect(adminRedirect(signedIn("BOUTIQUE_ADMIN"), "/admin/orders")).toBeNull();
    expect(adminRedirect(signedIn("SUPERADMIN"), "/admin")).toBeNull();
  });

  it("keeps a seller to the checkout and the help page", () => {
    expect(adminRedirect(signedIn("SELLER"), "/admin/orders")).toBe("/admin/pos");
    expect(adminRedirect(signedIn("SELLER"), "/admin/posters")).toBe("/admin/pos");
    expect(adminRedirect(signedIn("SELLER"), "/admin/pos/sessions/s1")).toBeNull();
    expect(adminRedirect(signedIn("SELLER"), "/admin/help")).toBeNull();
  });

  it("holds an admin who must set up 2FA on Settings", () => {
    expect(adminRedirect(signedIn("BOUTIQUE_ADMIN", true), "/admin/orders")).toBe(
      "/admin/settings",
    );
    expect(adminRedirect(signedIn("BOUTIQUE_ADMIN", true), "/admin/settings")).toBeNull();
  });

  it("never holds a seller on Settings, which they can't open", () => {
    expect(adminRedirect(signedIn("SELLER", true), "/admin/pos")).toBeNull();
  });
});
