"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { walletAccountSchema } from "@/lib/validation/settings";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { detectImageSignature } from "@/lib/shop/image-signature";

const PRODUCT_IMAGES_BUCKET = "product-images";

async function uploadWalletLogo(
  file: File,
): Promise<{ path: string } | { error: "uploadFailed" | "invalidFile" }> {
  const fileBuffer = await file.arrayBuffer();
  const detected = detectImageSignature(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `branding/wallet-${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: detected.contentType });

  if (error) {
    return { error: "uploadFailed" };
  }
  return { path: storagePath };
}

export async function createWalletAccount(formData: FormData) {
  const { productType } = await requireAdminScope();
  const parsed = walletAccountSchema.safeParse({
    provider: formData.get("provider"),
    number: formData.get("number"),
  });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  let logoStoragePath: string | null = null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const uploaded = await uploadWalletLogo(logo);
    if ("error" in uploaded) {
      return uploaded;
    }
    logoStoragePath = uploaded.path;
  }

  const maxPosition = await prisma.walletAccount.aggregate({
    where: { productType },
    _max: { position: true },
  });

  const wallet = await prisma.walletAccount.create({
    data: {
      ...parsed.data,
      productType,
      logoStoragePath,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { wallet };
}

export async function updateWalletAccount(id: string, formData: FormData) {
  const { productType } = await requireAdminScope();
  const parsed = walletAccountSchema.safeParse({
    provider: formData.get("provider"),
    number: formData.get("number"),
  });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const existing = await prisma.walletAccount.findFirst({ where: { id, productType } });
  if (!existing) {
    return { error: "notFound" as const };
  }

  let logoStoragePath = existing.logoStoragePath;
  const logo = formData.get("logo");
  const removeLogo = formData.get("removeLogo") === "true";

  if (logo instanceof File && logo.size > 0) {
    const uploaded = await uploadWalletLogo(logo);
    if ("error" in uploaded) {
      return uploaded;
    }
    if (existing.logoStoragePath) {
      await createAdminClient()
        .storage.from(PRODUCT_IMAGES_BUCKET)
        .remove([existing.logoStoragePath]);
    }
    logoStoragePath = uploaded.path;
  } else if (removeLogo && existing.logoStoragePath) {
    await createAdminClient()
      .storage.from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
    logoStoragePath = null;
  }

  await prisma.walletAccount.update({
    where: { id },
    data: { ...parsed.data, logoStoragePath },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function deleteWalletAccount(id: string) {
  const { productType } = await requireAdminScope();

  const existing = await prisma.walletAccount.findFirst({ where: { id, productType } });
  if (!existing) {
    return { error: "notFound" as const };
  }

  if (existing.logoStoragePath) {
    await createAdminClient()
      .storage.from(PRODUCT_IMAGES_BUCKET)
      .remove([existing.logoStoragePath]);
  }

  await prisma.walletAccount.deleteMany({ where: { id, productType } });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function moveWalletAccount(id: string, direction: "up" | "down") {
  const { productType } = await requireAdminScope();

  const wallets = await prisma.walletAccount.findMany({
    where: { productType },
    orderBy: { position: "asc" },
  });
  const index = wallets.findIndex((w) => w.id === id);
  if (index === -1) {
    return { error: "notFound" as const };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= wallets.length) {
    return {};
  }

  const a = wallets[index];
  const b = wallets[swapIndex];
  await prisma.$transaction([
    prisma.walletAccount.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.walletAccount.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}
