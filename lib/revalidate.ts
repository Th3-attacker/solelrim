import "server-only";
import { revalidatePath } from "next/cache";

// Every page sits under a locale segment (localePrefix "always" in
// i18n/routing.ts): the real URLs are /fr/admin/orders, /ar/sport/products/…
// A literal "/admin/orders" names no route, so revalidatePath("/admin/orders")
// invalidated nothing. These name the route patterns instead, every locale
// and every boutique at once.
//
// Called from a Server Action, any of them also sends the current page back
// re-rendered with the action's answer, so the client needs no
// router.refresh() after it.

// The back office: every page under /[locale]/admin.
export function revalidateAdmin(): void {
  revalidatePath("/[locale]/admin", "layout");
}

// The storefronts: every page of every boutique.
export function revalidateStorefront(): void {
  revalidatePath("/[locale]/[storeType]", "layout");
}

// Both, for what shows on either side (a boutique's name, theme, wallets…).
export function revalidateSite(): void {
  revalidatePath("/", "layout");
}
