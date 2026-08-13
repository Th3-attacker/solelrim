"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseISO, isValid } from "date-fns";
import {
  boutiqueSettingsSchema,
  productTypeInputSchema,
  storeDomainSchema,
  type BoutiqueSettingsInput,
} from "@/lib/validation/settings";
import { THEME_PRESETS } from "@/lib/theme/presets";
import { SUGGESTED_CATEGORIES, RESERVED_STORE_TYPE_KEYS } from "@/lib/shop/product-type";
import { slugify } from "@/lib/shop/slug";
import { getSiteUrl } from "@/lib/shop/site-url";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { detectImageSignature } from "@/lib/shop/image-signature";

const PRODUCT_IMAGES_BUCKET = "product-images";

// --- Per-boutique settings (both roles — scoped to the acting admin's
// boutique, or whichever one a superadmin currently has selected) ---

export async function updateBoutiqueSettings(
  input: BoutiqueSettingsInput,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();
  const parsed = boutiqueSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: parsed.data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function uploadStoreLogo(
  formData: FormData,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }

  // File.type/file.name are client-declared metadata — trust the actual
  // bytes instead, same as the payment-screenshot upload in orders.ts.
  const fileBuffer = await file.arrayBuffer();
  const detected = detectImageSignature(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `branding/logo-${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: detected.contentType,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.logoStoragePath) {
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { logoStoragePath: storagePath },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function removeStoreLogo(): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.logoStoragePath) {
    const supabase = createAdminClient();
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { logoStoragePath: null },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

// --- Per-boutique storefront settings (hero image + theme) — both roles,
// same scope as updateBoutiqueSettings above. Each boutique has its own
// public route now, so its own admin manages its own storefront look. ---

export async function uploadStoreHeroImage(
  formData: FormData,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }

  const fileBuffer = await file.arrayBuffer();
  const detected = detectImageSignature(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `branding/hero-${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: detected.contentType,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.heroImagePath) {
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.heroImagePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { heroImagePath: storagePath },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function removeStoreHeroImage(): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.heroImagePath) {
    const supabase = createAdminClient();
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.heroImagePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { heroImagePath: null },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function setStoreTheme(themeId: string): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  if (!THEME_PRESETS.some((preset) => preset.id === themeId)) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { themeId },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

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

  revalidatePath("/admin/settings/global");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return {};
}

// A custom store type beyond the sport/cosmetique presets: no translated
// label (displayed as typed), no theme switch (keeps whatever is active),
// and only the categories the admin lists here — no SUGGESTED_CATEGORIES
// entry to draw from.
export async function createProductType(
  input: unknown,
): Promise<{ error?: string }> {
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

  revalidatePath("/admin/settings/global");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return {};
}

// --- Infrastructure: custom domain + license (superadmin only, never via
// requireAdminScope) — both take productType explicitly, since the
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

  revalidatePath("/admin/settings/global");
  revalidatePath("/", "layout");
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

  revalidatePath("/admin/settings/global");
  revalidatePath("/admin", "layout");
  return {};
}
