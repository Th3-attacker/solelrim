"use server";

import { PENDING_AUTO_CANCEL_CHOICES } from "@/lib/shop/order-status";
import { prisma } from "@/lib/prisma";
import { parseISO, isValid } from "date-fns";
import {
  licenseClientNameSchema,
  licenseStatusSchema,
  licenseTypeSchema,
  productTypeInputSchema,
  solalContactSchema,
  storeDomainSchema,
  storeTypeLabelSchema,
} from "@/lib/validation/settings";
import { SUGGESTED_CATEGORIES, RESERVED_STORE_TYPE_KEYS } from "@/lib/shop/product-type";
import { slugify } from "@/lib/shop/slug";
import { getSiteUrl } from "@/lib/shop/site-url";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { revalidateAdmin, revalidateSite } from "@/lib/revalidate";

// The boutiques themselves, superadmin side: the registry (create, rename,
// delete, custom domain, the default one), licenses and their options, and
// SOLAL's own contact for the contract. Each boutique's own settings and
// appearance stay in lib/actions/settings.ts.

// --- Default boutique (superadmin only) — which one "/" redirects to ---

// Validates against StoreType (the durable registry) instead of a hardcoded
// preset list — every boutique that has ever been created, built-in or
// custom, is always re-selectable.
export async function setProductType(productType: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const storeType = await prisma.storeType.findUnique({ where: { key: productType } });
  if (!storeType) {
    return { error: "invalid" };
  }

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { productType },
    create: { id: "singleton", productType },
  });

  // Additive only — never renames or deletes an existing category, so
  // switching back and forth never touches categories already in use by
  // real products. Only the two built-in presets have a suggested set;
  // a custom type's categories were already created by createProductType.
  const suggested = SUGGESTED_CATEGORIES[productType];
  if (suggested) {
    await prisma.category.createMany({
      data: suggested.map((name) => ({ name, productType })),
      skipDuplicates: true,
    });
  }

  revalidateSite();
  return {};
}

// A custom store type beyond the sport/cosmetique presets: no translated
// label (displayed as typed), no theme switch (keeps whatever is active),
// and only the categories the admin lists here — no SUGGESTED_CATEGORIES
// entry to draw from.
export async function createProductType(input: unknown): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const parsed = productTypeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { name, categories } = parsed.data;
  const key = slugify(name);

  if (RESERVED_STORE_TYPE_KEYS.has(key)) {
    return { error: "reservedKey" };
  }

  try {
    await prisma.storeType.create({ data: { key, label: name } });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateKey" };
    }
    throw err;
  }

  const uniqueCategories = [...new Set(categories)];
  if (uniqueCategories.length > 0) {
    await prisma.category.createMany({
      data: uniqueCategories.map((categoryName) => ({
        name: categoryName,
        productType: key,
      })),
      skipDuplicates: true,
    });
  }

  revalidateSite();
  return {};
}

// Rename only — key stays immutable (see storeTypeLabelSchema).
export async function updateStoreTypeLabel(
  productType: string,
  label: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const parsed = storeTypeLabelSchema.safeParse({ label });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { label: parsed.data.label },
  });

  revalidateSite();
  return {};
}

// Deletes a boutique outright — only possible once it holds none of its own
// data and isn't the "/" default. Pre-checked explicitly (rather than
// letting the FK RESTRICT constraints bubble as a raw P2003) so the admin
// gets a typed, actionable reason instead of a generic 500, mirroring
// deleteCategory/deleteProduct. Category rows are the one exception — they
// SET NULL on delete (see prisma/schema.prisma) and become generic
// categories, so they're never part of this check.
export async function deleteStoreType(productType: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const [storeType, settings] = await Promise.all([
    prisma.storeType.findUnique({ where: { key: productType } }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!storeType) {
    return { error: "notFound" };
  }
  if (settings?.productType === productType) {
    return { error: "isDefaultStore" };
  }

  const [
    productCount,
    orderCount,
    saleCount,
    clientCount,
    adminUserCount,
    socialLinkCount,
    testimonialCount,
    walletAccountCount,
    promoCodeCount,
    cashSessionCount,
    dayClosureCount,
  ] = await Promise.all([
    prisma.product.count({ where: { productType } }),
    prisma.order.count({ where: { productType } }),
    prisma.sale.count({ where: { productType } }),
    prisma.client.count({ where: { productType } }),
    prisma.adminUser.count({ where: { productType } }),
    prisma.socialLink.count({ where: { productType } }),
    prisma.testimonial.count({ where: { productType } }),
    prisma.walletAccount.count({ where: { productType } }),
    prisma.promoCode.count({ where: { productType } }),
    prisma.cashSession.count({ where: { productType } }),
    prisma.storeDayClosure.count({ where: { productType } }),
  ]);
  const hasData =
    productCount +
      orderCount +
      saleCount +
      clientCount +
      adminUserCount +
      socialLinkCount +
      testimonialCount +
      walletAccountCount +
      promoCodeCount +
      cashSessionCount +
      dayClosureCount >
    0;
  if (hasData) {
    return { error: "hasData" };
  }

  await prisma.storeType.delete({ where: { key: productType } });

  revalidateSite();
  return {};
}

// --- Infrastructure: custom domain + license (superadmin only, never via
// requireWritableAdminScope) — both take productType explicitly, since the
// superadmin is editing an arbitrary row out of the all-boutiques table on
// Réglages globaux, not "whichever boutique is currently scoped". ---

export async function updateStoreDomain(
  productType: string,
  domain: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const parsed = storeDomainSchema.safeParse({ domain });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const normalized = parsed.data.domain || null;

  if (normalized && normalized === new URL(getSiteUrl()).hostname) {
    return { error: "reservedDomain" };
  }

  try {
    await prisma.storeType.update({
      where: { key: productType },
      data: { domain: normalized },
    });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateDomain" };
    }
    throw err;
  }

  revalidateSite();
  return {};
}

export async function updateLicenseExpiresAt(
  productType: string,
  licenseExpiresAt: string | null,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  let parsedDate: Date | null = null;
  if (licenseExpiresAt) {
    parsedDate = parseISO(licenseExpiresAt);
    if (!isValid(parsedDate)) {
      return { error: "invalid" };
    }
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { licenseExpiresAt: parsedDate },
  });

  revalidateAdmin();
  return {};
}

// Sets the plan (MONTHLY/YEARLY/PERPETUAL) and the manual override
// (ACTIVE/SUSPENDED/CANCELLED — see lib/shop/license.ts for how those
// combine with licenseExpiresAt into the actual enforced state).
export async function updateBoutiqueLicense(
  productType: string,
  input: { licenseType: string; licenseStatus: string },
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const typeParsed = licenseTypeSchema.safeParse(input.licenseType);
  const statusParsed = licenseStatusSchema.safeParse(input.licenseStatus);
  if (!typeParsed.success || !statusParsed.success) {
    return { error: "invalid" };
  }

  const existing = await prisma.storeType.findUnique({
    where: { key: productType },
    select: { licenseType: true, licenseStatus: true },
  });
  if (!existing) {
    return { error: "notFound" };
  }

  // The only place licenseStartedAt is ever written — there's no separate
  // date picker for it. Stamped whenever the plan itself changes, or
  // whenever it (re)activates from a non-ACTIVE state, so it always
  // reflects when the *current* period began, not the boutique's original
  // signup date.
  const isNewPeriod =
    typeParsed.data !== existing.licenseType ||
    (statusParsed.data === "ACTIVE" && existing.licenseStatus !== "ACTIVE");

  await prisma.storeType.update({
    where: { key: productType },
    data: {
      licenseType: typeParsed.data,
      licenseStatus: statusParsed.data,
      ...(isNewPeriod ? { licenseStartedAt: new Date() } : {}),
    },
  });

  revalidateSite();
  return {};
}

// Per-boutique feature flag — superadmin-only, same "infrastructure" tier
// as domain/license rather than something a BOUTIQUE_ADMIN can flip on
// themselves.
export async function setCouponsEnabled(
  productType: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  await prisma.storeType.update({
    where: { key: productType },
    data: { couponsEnabled: enabled },
  });

  revalidateAdmin();
  return {};
}

// Hours before an unvalidated PENDING order is cancelled on its own (null =
// never). Superadmin-only like the coupons flag; one of the preset choices,
// so a typo can't set "2 hours" and wipe a day's orders.
export async function setPendingAutoCancelHours(
  productType: string,
  hours: number | null,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  if (hours !== null && !(PENDING_AUTO_CANCEL_CHOICES as readonly number[]).includes(hours)) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { pendingAutoCancelHours: hours },
  });

  revalidateAdmin();
  return {};
}

// The Client's legal name for the auto-generated license contract's section
// 34 (components/settings/license-contract-document.tsx) — same
// superadmin-only, "infrastructure" tier as the domain/license fields above.
export async function updateLicenseClientName(
  productType: string,
  licenseClientName: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const parsed = licenseClientNameSchema.safeParse({ licenseClientName });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { licenseClientName: parsed.data.licenseClientName || null },
  });

  revalidateAdmin();
  return {};
}

// SOLAL's own contact info for the same contract's section 34 — a single
// row (SolalContact, "singleton"), so this never targets a boutique.
// Superadmin-only, same as every other "infrastructure" field above.
export async function updateSolalContact(input: unknown): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const parsed = solalContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.solalContact.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  revalidateAdmin();
  return {};
}
