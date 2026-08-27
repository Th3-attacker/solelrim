import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { hasAdminCredentials, loginAsAdmin } from "./helpers";

// Same real boutique/product as checkout.spec.ts and admin-order-lifecycle.spec.ts
// use — no seeded/isolated fixture boutique exists yet (see e2e/helpers.ts).
const STORE_HOME = "/fr/sport";
const PRODUCT_URL = "/fr/sport/products/tshirt-plyester";

// Gated on critical/serious only for now. Moderate/minor findings can exist
// project-wide (long-tail contrast on secondary text, third-party widget
// markup, etc.) and would make every one of these red on day one for
// issues unrelated to whatever change triggered the run — tighten this
// list once those are triaged and cleared.
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

function formatViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const targets = v.nodes.map((n) => `  - ${n.target.join(" ")}`).join("\n");
      return `${v.id} [${v.impact}] ${v.help} (${v.helpUrl})\n${targets}`;
    })
    .join("\n\n");
}

async function expectNoBlockingViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ""));
  expect(blocking, formatViolations(blocking)).toEqual([]);
}

test.describe("accessibility", () => {
  test("storefront home has no critical/serious a11y violations", async ({ page }) => {
    await page.goto(STORE_HOME);
    await expectNoBlockingViolations(page);
  });

  test("product page has no critical/serious a11y violations", async ({ page }) => {
    await page.goto(PRODUCT_URL);
    await expectNoBlockingViolations(page);
  });

  test("checkout step 1 has no critical/serious a11y violations", async ({ page }) => {
    await page.goto(PRODUCT_URL);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    await page.getByRole("link", { name: "Passer la commande" }).click();
    await page.waitForURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Vos informations" })).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("admin login has no critical/serious a11y violations", async ({ page }) => {
    await page.goto("/fr/admin/login");
    await expectNoBlockingViolations(page);
  });

  // Needs a real admin account, same E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD
  // convention as e2e/admin-login.spec.ts — skipped rather than failed
  // when unset.
  test("admin dashboard has no critical/serious a11y violations", async ({ page }) => {
    test.skip(!hasAdminCredentials(), "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await expectNoBlockingViolations(page);
  });
});
