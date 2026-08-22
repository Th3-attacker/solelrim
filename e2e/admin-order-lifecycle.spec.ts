import { expect, test } from "@playwright/test";
import { hasAdminCredentials, loginAsAdmin, openOrderByReference, submitCheckoutOrder } from "./helpers";

// Needs a real admin account, same as e2e/admin-login.spec.ts — no seeded/
// isolated test fixture exists yet. Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD
// (a real BOUTIQUE_ADMIN's or SUPERADMIN's credentials for the "sport"
// boutique, e.g. as CI secrets) to exercise these paths; skipped otherwise
// rather than failing on missing config.
test.describe("admin order lifecycle", () => {
  test.skip(!hasAdminCredentials(), "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set");

  test("confirms, ships, and delivers an order created at checkout", async ({ page }) => {
    test.setTimeout(60_000);
    const reference = await submitCheckoutOrder(page);

    await loginAsAdmin(page);
    await openOrderByReference(page, reference);

    // PENDING -> CONFIRMED (behind an AlertDialog confirmation)
    await expect(page.getByText("En attente")).toBeVisible();
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
    await expect(page.getByText("Confirmée")).toBeVisible({ timeout: 15_000 });

    // CONFIRMED -> SHIPPING (no confirmation step)
    await page.getByRole("button", { name: "Expédier" }).click();
    await expect(page.getByText("En livraison")).toBeVisible({ timeout: 15_000 });

    // SHIPPING -> DELIVERED (no confirmation step)
    await page.getByRole("button", { name: "Marquer comme livrée" }).click();
    await expect(page.getByText("Livrée")).toBeVisible({ timeout: 15_000 });
  });

  test("rejecting a pending order records the reason and stops progress actions", async ({ page }) => {
    const reference = await submitCheckoutOrder(page);

    await loginAsAdmin(page);
    await openOrderByReference(page, reference);

    await expect(page.getByText("En attente")).toBeVisible();
    await page.getByRole("button", { name: "Rejeter" }).click();
    // Scoped to the dialog — the page's own "Confirmer" (order-confirm)
    // trigger button is still in the DOM behind it, with the same name.
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Produit en rupture de stock" }).click();
    await dialog.getByRole("button", { name: "Confirmer", exact: true }).click();

    await expect(page.getByText("Rejetée")).toBeVisible();
    await expect(page.getByText("Produit en rupture de stock")).toBeVisible();
    // No progress actions left on a terminal order — nothing left to confirm/ship.
    await expect(page.getByRole("button", { name: "Expédier" })).toHaveCount(0);
  });
});
