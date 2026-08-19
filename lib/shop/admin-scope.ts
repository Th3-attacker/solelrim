import { cookies } from "next/headers";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";
import { DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";
import { getCurrentAdmin } from "@/lib/auth/admin";
import type { AdminUser } from "@/lib/generated/prisma/client";

// Independent from StoreSettings.productType (the public "live" toggle) —
// lets a superadmin browse/manage one boutique's back office while a
// different one is currently live to customers. See
// lib/actions/admin-scope.ts.
export const ADMIN_SCOPE_COOKIE = "admin_store_scope";

export async function getAdminScope(): Promise<string> {
  // A boutique admin is permanently locked to their assigned boutique —
  // the free-choice cookie is never consulted for this role, so nothing
  // (a stale cookie, a crafted request) can move them outside it.
  const admin = await getCurrentAdmin().catch(() => null);
  if (admin?.role === "BOUTIQUE_ADMIN") {
    return admin.productType!;
  }

  const storeTypes = await getStoreTypes();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_SCOPE_COOKIE)?.value;
  if (cookieValue && storeTypes.some((t) => t.key === cookieValue)) {
    return cookieValue;
  }

  const settings = await getStoreSettings();
  if (storeTypes.some((t) => t.key === settings.productType)) {
    return settings.productType;
  }

  return storeTypes[0]?.key ?? DEFAULT_PRODUCT_TYPE;
}

// The single replacement for every action's old
// `requireAdmin(); ...; const productType = await getAdminScope();` pair —
// resolves both "is this a recognized admin" and "which boutique are they
// acting on" in one call, with the BOUTIQUE_ADMIN lock from getAdminScope()
// above applying automatically.
export async function requireAdminScope(): Promise<{
  admin: AdminUser;
  productType: string;
}> {
  const admin = await getCurrentAdmin();
  const productType =
    admin.role === "BOUTIQUE_ADMIN" ? admin.productType! : await getAdminScope();
  return { admin, productType };
}

// For settings reserved to SUPERADMIN (theme/color, color mode, hero/card
// layout variants) but still scoped to whichever boutique they're currently
// managing, same as requireAdminScope — unlike requireSuperAdmin() alone,
// this also resolves productType instead of leaving the caller to pass it
// explicitly (that pattern is for the global, cross-boutique table instead).
export async function requireSuperAdminScope(): Promise<{
  admin: AdminUser;
  productType: string;
}> {
  const { admin, productType } = await requireAdminScope();
  if (admin.role !== "SUPERADMIN") {
    throw new Error("forbidden");
  }
  return { admin, productType };
}

// Theme/color, color mode, and hero/card layout variants: superadmin-only
// by default, but a BOUTIQUE_ADMIN can be granted a per-account exception
// (AdminUser.canManageAppearance, set via setAdminCanManageAppearance) to
// manage their own boutique's appearance without full superadmin access.
export async function requireAppearanceScope(): Promise<{
  admin: AdminUser;
  productType: string;
}> {
  const { admin, productType } = await requireAdminScope();
  if (admin.role !== "SUPERADMIN" && !admin.canManageAppearance) {
    throw new Error("forbidden");
  }
  return { admin, productType };
}
