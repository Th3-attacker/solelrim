"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { walletAccountSchema } from "@/lib/validation/settings";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { findWalletProvider } from "@/lib/shop/wallet-providers";

const PRODUCT_IMAGES_BUCKET = "product-images";

// The logo is no longer uploaded: a known provider (lib/shop/wallet-providers)
// has its own bundled one. Accounts created before that may still carry an
// uploaded logo; it stays for a provider we don't know, and goes as soon as
// the account is saved with one we do.
export async function createWalletAccount(formData: FormData) {
  const { productType } = await requireWritableAdminScope();
  const parsed = walletAccountSchema.safeParse({
    provider: formData.get("provider"),
    number: formData.get("number"),
  });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const maxPosition = await prisma.walletAccount.aggregate({
    where: { productType },
    _max: { position: true },
  });

  const wallet = await prisma.walletAccount.create({
    data: {
      ...parsed.data,
      productType,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { wallet };
}

export async function updateWalletAccount(id: string, formData: FormData) {
  const { productType } = await requireWritableAdminScope();
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
  if (logoStoragePath && findWalletProvider(parsed.data.provider)) {
    await createAdminClient().storage.from(PRODUCT_IMAGES_BUCKET).remove([logoStoragePath]);
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
  const { productType } = await requireWritableAdminScope();

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
  const { productType } = await requireWritableAdminScope();

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
