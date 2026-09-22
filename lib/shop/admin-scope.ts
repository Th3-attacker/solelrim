import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStoreSettings, getStoreTypes } from "@/lib/queries/settings";
import { DEFAULT_PRODUCT_TYPE } from "@/lib/shop/product-type";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getEffectiveLicenseState, isLicenseBlocking } from "@/lib/shop/license";
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
  await assertLicenseWritable(admin, productType);
  return { admin, productType };
}

// Thrown by assertLicenseWritable/requireWritableAdminScope so callers (the
// dashboard's error.tsx) can tell "your boutique is suspended/expired" apart
// from an unexpected bug, instead of showing the same generic error for
// both.
export class LicenseBlockedError extends Error {
  constructor() {
    super("licenseBlocked");
    this.name = "LicenseBlockedError";
  }
}

// A SUPERADMIN always bypasses — they're the ones who suspend/reactivate a
// boutique in the first place (updateBoutiqueLicense), and must never be
// locked out of the very screen that does that. Only a BOUTIQUE_ADMIN
// acting on their own (or, via the free-choice cookie, a SUPERADMIN acting
// *as* a boutique — but that path never reaches here since it's still a
// SUPERADMIN role) boutique gets blocked.
async function assertLicenseWritable(admin: AdminUser, productType: string): Promise<void> {
  if (admin.role === "SUPERADMIN") return;

  const storeType = await prisma.storeType.findUnique({
    where: { key: productType },
    select: { licenseType: true, licenseStatus: true, licenseExpiresAt: true },
  });
  if (!storeType) return;

  if (isLicenseBlocking(getEffectiveLicenseState(storeType))) {
    throw new LicenseBlockedError();
  }
}

// The gate every mutating Server Action (lib/actions/*.ts) uses instead of
// requireAdminScope: same identity + scope resolution, plus "is this
// boutique actually allowed to be written to right now". Read-only call
// sites (the categories/settings pages, which only need `admin`/productType
// to render) deliberately keep using plain requireAdminScope — a suspended
// boutique's own admin can still see their dashboard and the license
// section explaining why, only writes are rejected here, not the whole UI.
export async function requireWritableAdminScope(): Promise<{
  admin: AdminUser;
  productType: string;
}> {
  const { admin, productType } = await requireAdminScope();
  await assertLicenseWritable(admin, productType);
  return { admin, productType };
}
