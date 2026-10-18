import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { SHOP_DATA_TAG } from "@/lib/data-cache";

// Ces helpers nomment ce qu'une écriture a changé (le back-office, les
// vitrines, ou les deux), par les dossiers de routes de src/routes. Appelés
// depuis une server action, ils font recharger au navigateur les données de
// la page courante avant que l'action ne rende son résultat (voir
// src/compat/next/cache.ts et src/compat/server-action-reference.ts), comme
// le re-rendu serveur de Next.js : le client n'a pas besoin de
// router.refresh() après coup.

// The back office: every page under /$locale/admin.
export function revalidateAdmin(): void {
  revalidatePath("/$locale/admin", "layout");
  expireShopData();
}

// The storefronts: every page of every boutique.
export function revalidateStorefront(): void {
  revalidatePath("/$locale/$storeType", "layout");
  expireShopData();
}

// Both, for what shows on either side (a boutique's name, theme, wallets…).
export function revalidateSite(): void {
  revalidatePath("/", "layout");
  expireShopData();
}

// The storefront's cached reads (lib/data-cache.ts), right away: admin writes
// (stock, prices, settings) and customer orders all show on a storefront.
function expireShopData(): void {
  revalidateTag(SHOP_DATA_TAG, { expire: 0 });
}
