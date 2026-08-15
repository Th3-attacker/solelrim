import path from "node:path";
import { test, expect } from "@playwright/test";

// Targets a real, known product in the "sport" boutique (Tshirt Plyester,
// WHITE/M variant in stock) — there's no seeded/isolated test fixture
// boutique yet, so this exercises the actual dev database's real catalog.
const PRODUCT_URL = "/fr/sport/products/tshirt-plyester";
const PAYMENT_PROOF = path.join(__dirname, "fixtures/payment-proof.png");

test.describe("checkout", () => {
  test("customer can add to cart, fill in info, and submit an order", async ({ page }) => {
    await page.goto(PRODUCT_URL);

    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Ajouté au panier.")).toBeVisible();

    await page.getByRole("button", { name: "Panier" }).click();
    await page.getByRole("button", { name: "Passer la commande" }).click();

    // Step 1 — customer info
    await expect(page.getByText("Vos informations")).toBeVisible();
    await page.getByLabel("Nom complet").fill("Test E2E");
    await page.getByLabel("Numéro de téléphone").fill("37737353");
    await page.getByLabel("Ville").fill("Nouakchott");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2 — order summary, no promo code
    await expect(page.getByText("Résumé de la commande")).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 3 — payment: reveal wallets + upload, then submit
    await expect(page.getByText("Paiement", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByLabel("Capture d'écran du paiement").setInputFiles(PAYMENT_PROOF);

    await page.getByRole("button", { name: "Confirmer la commande" }).click();

    await expect(page.getByText("Commande envoyée !")).toBeVisible({ timeout: 15_000 });
  });
});
