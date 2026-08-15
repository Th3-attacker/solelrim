import { test, expect } from "@playwright/test";

test.describe("admin login", () => {
  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/fr/admin/login");

    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await page.getByLabel("Email").fill("not-a-real-admin@example.com");
    await page.getByLabel("Mot de passe").fill("wrong-password");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
    // Still on the login screen — nothing let it through.
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  // Needs a real admin account — no seeded/isolated test fixture exists yet.
  // Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (a real BOUTIQUE_ADMIN's
  // credentials, e.g. as CI secrets) to exercise the actual sign-in path;
  // skipped otherwise rather than failing on missing config.
  test("signs in and reaches the dashboard", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set");

    await page.goto("/fr/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Mot de passe").fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/admin(?!\/login)/);
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  });
});
