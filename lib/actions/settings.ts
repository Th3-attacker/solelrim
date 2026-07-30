"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import { THEME_PRESETS } from "@/lib/theme/presets";

const PRODUCT_IMAGES_BUCKET = "product-images";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
}

export async function updateStoreSettings(
  input: SettingsInput,
): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function uploadStoreLogo(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }

  const ext = file.name.split(".").pop() ?? "png";
  const storagePath = `branding/logo-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const existing = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
  });
  if (existing?.logoStoragePath) {
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
  }

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { logoStoragePath: storagePath },
    create: { id: "singleton", logoStoragePath: storagePath },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function removeStoreLogo(): Promise<{ error?: string }> {
  await requireAdmin();

  const existing = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
  });
  if (existing?.logoStoragePath) {
    const supabase = createAdminClient();
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
  }

  await prisma.storeSettings.update({
    where: { id: "singleton" },
    data: { logoStoragePath: null },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}


export async function setStoreTheme(themeId: string): Promise<{ error?: string }> {
  await requireAdmin();

  if (!THEME_PRESETS.some((preset) => preset.id === themeId)) {
    return { error: "invalid" };
  }

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { themeId },
    create: { id: "singleton", themeId },

  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}
