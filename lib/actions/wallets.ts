"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { walletAccountSchema } from "@/lib/validation/settings";
import { requireAdminScope } from "@/lib/shop/admin-scope";

export async function createWalletAccount(input: unknown) {
  const { productType } = await requireAdminScope();
  const parsed = walletAccountSchema.safeParse(input);
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

export async function deleteWalletAccount(id: string) {
  const { productType } = await requireAdminScope();

  const deleted = await prisma.walletAccount.deleteMany({
    where: { id, productType },
  });
  if (deleted.count === 0) {
    return { error: "notFound" as const };
  }

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
