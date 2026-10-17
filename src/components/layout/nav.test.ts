import { describe, expect, it } from "vitest";
import { NAV, navFor } from "./nav";

describe("navFor", () => {
  it("shows admins every group they may open", () => {
    expect(navFor("BOUTIQUE_ADMIN").length).toBeGreaterThan(0);
    expect(navFor("SUPERADMIN").length).toBe(NAV.length);
  });

  it("never shows a seller an admin-only entry", () => {
    const items = navFor("SELLER").flatMap((group) => group.items);
    expect(items.every((item) => item.roles?.includes("SELLER"))).toBe(true);
  });

  it("keeps the phone's bottom bar to four entries plus « Plus »", () => {
    const tabs = NAV.flatMap((group) => group.items).filter((item) => item.tabBar);
    expect(tabs.length).toBeLessThanOrEqual(4);
  });
});
