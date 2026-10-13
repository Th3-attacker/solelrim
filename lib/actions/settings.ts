"use server";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  boutiqueSettingsSchema,
  cardVariantSchema,
  colorModeSchema,
  customThemeColorSchema,
  footerVariantSchema,
  heroVariantSchema,
  type BoutiqueSettingsInput,
} from "@/lib/validation/settings";
import { CUSTOM_THEME_ID, THEME_PRESETS } from "@/lib/theme/presets";
import {
  requireWritableAdminScope,
  requireWritableSuperAdminScope,
  requireAppearanceScope,
} from "@/lib/auth/scope";
import { validateImageBytes, MAX_IMAGE_BYTES } from "@/lib/shop/image-signature";
import { revalidateSite } from "@/lib/revalidate";
import { PUBLIC_IMAGE_CACHE_CONTROL } from "@/lib/image-config";

const PRODUCT_IMAGES_BUCKET = "product-images";

// --- Per-boutique settings (both roles — scoped to the acting admin's
// boutique, or whichever one a superadmin currently has selected) ---

export async function updateBoutiqueSettings(
  input: BoutiqueSettingsInput,
): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const parsed = boutiqueSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  // The "Image principale" section (hero texts and image position) and the
  // SEO texts are the superadmin's: a boutique admin's form doesn't show
  // them, and whatever they send for them is left out, not trusted.
  const {
    heroImagePosition,
    heroBadgeText,
    heroTitle,
    heroTitleAr,
    heroTitleEn,
    heroSubtitle,
    heroSubtitleAr,
    heroSubtitleEn,
    heroCtaLabel,
    seoTitle,
    seoTitleAr,
    seoTitleEn,
    seoDescription,
    seoDescriptionAr,
    seoDescriptionEn,
    ...general
  } = parsed.data;
  const superadminOnly = {
    heroImagePosition,
    heroBadgeText,
    heroTitle,
    heroTitleAr,
    heroTitleEn,
    heroSubtitle,
    heroSubtitleAr,
    heroSubtitleEn,
    heroCtaLabel,
    seoTitle,
    seoTitleAr,
    seoTitleEn,
    seoDescription,
    seoDescriptionAr,
    seoDescriptionEn,
  };

  await prisma.storeType.update({
    where: { key: productType },
    data: admin.role === "SUPERADMIN" ? { ...general, ...superadminOnly } : general,
  });

  revalidateSite();
  return {};
}

export async function uploadStoreLogo(formData: FormData): Promise<{ error?: string }> {
  const { productType } = await requireWritableSuperAdminScope();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return { error: "invalidFile" };
  }

  // File.type/file.name are client-declared metadata — trust the actual
  // bytes instead, same as the payment-screenshot upload in orders.ts.
  const fileBuffer = await file.arrayBuffer();
  const detected = validateImageBytes(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `branding/logo-${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: detected.contentType,
      cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.logoStoragePath) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.logoStoragePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { logoStoragePath: storagePath },
  });

  revalidateSite();
  return {};
}

export async function removeStoreLogo(): Promise<{ error?: string }> {
  const { productType } = await requireWritableSuperAdminScope();

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.logoStoragePath) {
    const supabase = createAdminClient();
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.logoStoragePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { logoStoragePath: null },
  });

  revalidateSite();
  return {};
}

// --- Per-boutique storefront settings (hero image + theme). The hero image
// is superadmin-only (like the SEO texts): it is the boutique's main image
// on search results and shares. Same scope as updateBoutiqueSettings above. ---

export async function uploadStoreHeroImage(formData: FormData): Promise<{ error?: string }> {
  const { productType } = await requireWritableSuperAdminScope();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return { error: "invalidFile" };
  }

  const fileBuffer = await file.arrayBuffer();
  const detected = validateImageBytes(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `branding/hero-${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: detected.contentType,
      cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.heroImagePath) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.heroImagePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { heroImagePath: storagePath },
  });

  revalidateSite();
  return {};
}

export async function removeStoreHeroImage(): Promise<{ error?: string }> {
  const { productType } = await requireWritableSuperAdminScope();

  const existing = await prisma.storeType.findUnique({ where: { key: productType } });
  if (existing?.heroImagePath) {
    const supabase = createAdminClient();
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.heroImagePath]);
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { heroImagePath: null },
  });

  revalidateSite();
  return {};
}

export async function setStoreTheme(themeId: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  if (!THEME_PRESETS.some((preset) => preset.id === themeId)) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { themeId, customThemeColor: null },
  });

  revalidateSite();
  return {};
}

// Picking a custom color switches themeId to the "custom" sentinel, same
// as picking any other preset switches it to that preset's id — the two
// pickers are mutually exclusive views onto the same underlying field.
export async function setCustomThemeColor(color: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  const parsed = customThemeColorSchema.safeParse({ color });
  if (!parsed.success) {
    // "invalid" (malformed hex) or "lowContrast" (valid hex, but neither
    // black nor white text clears WCAG AA against it) — the picker needs to
    // tell those apart to show the right message.
    return { error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { themeId: CUSTOM_THEME_ID, customThemeColor: parsed.data.color },
  });

  revalidateSite();
  return {};
}

export async function setColorMode(mode: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  const parsed = colorModeSchema.safeParse(mode);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { colorMode: parsed.data },
  });

  revalidateSite();
  return {};
}

export async function setHeroVariant(variant: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  const parsed = heroVariantSchema.safeParse(variant);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { heroVariant: parsed.data },
  });

  revalidateSite();
  return {};
}

export async function setCardVariant(variant: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  const parsed = cardVariantSchema.safeParse(variant);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { cardVariant: parsed.data },
  });

  revalidateSite();
  return {};
}

export async function setFooterVariant(variant: string): Promise<{ error?: string }> {
  const { productType } = await requireAppearanceScope();

  const parsed = footerVariantSchema.safeParse(variant);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeType.update({
    where: { key: productType },
    data: { footerVariant: parsed.data },
  });

  revalidateSite();
  return {};
}
