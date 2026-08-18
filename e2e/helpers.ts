import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Targets a real, known product in the "sport" boutique (Tshirt Plyester,
// WHITE/M variant in stock) — there's no seeded/isolated test fixture
// boutique yet, so this exercises the actual dev database's real catalog
// (see e2e/checkout.spec.ts and e2e/admin-login.spec.ts for the same
// constraint on the admin side).
const PRODUCT_URL = "/fr/sport/products/tshirt-plyester";
const PAYMENT_PROOF = path.join(__dirname, "fixtures/payment-proof.png");
const ORDER_REFERENCE_RE = /CMD-\d{8}-\d{4}/;

// Runs the full customer checkout flow and returns the resulting order's
// reference — shared by checkout.spec.ts and admin-order-lifecycle.spec.ts
// so the two never drift on how an order gets created.
export async function submitCheckoutOrder(page: Page): Promise<string> {
  await page.goto(PRODUCT_URL);

  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByText("Ajouté au panier.")).toBeVisible();

  await page.getByRole("button", { name: "Panier" }).click();
  // "Passer la commande" now navigates to the dedicated /checkout page
  // (checkout used to be a Sheet, so this was a "button" click that opened
  // it in place) — it's a Link styled as a button, so its accessible role
  // is "link", and the click closes the cart Sheet while the browser
  // navigates.
  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL(/\/checkout$/);

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
  await page.getByRole("button", { name: "Voir les numéros de paiement" }).click();
  await page.getByLabel("Capture d'écran du paiement").setInputFiles(PAYMENT_PROOF);

  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByText("Commande envoyée !")).toBeVisible({ timeout: 15_000 });

  const reference = await page.getByText(ORDER_REFERENCE_RE).innerText();
  return reference;
}

// Real admin credentials, same E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD convention
// as e2e/admin-login.spec.ts — no seeded/isolated admin fixture exists yet,
// so tests that need one skip (rather than fail) when they're unset.
export function hasAdminCredentials(): boolean {
  return Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL!;
  const password = process.env.E2E_ADMIN_PASSWORD!;

  await page.goto("/fr/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
}

// Search-and-click is how every admin order test reaches a specific order's
// detail page — the orders list has no direct-by-reference route.
export async function openOrderByReference(page: Page, reference: string): Promise<void> {
  await page.goto("/fr/admin/orders");
  await page.getByLabel("Téléphone ou référence...").fill(reference);
  // The search box syncs to the URL (and re-fetches server-side) on a debounce
  // — wait for the filtered row instead of racing it.
  const link = page.getByRole("link", { name: reference });
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await expect(page).toHaveURL(/\/admin\/orders\/.+/);
}
