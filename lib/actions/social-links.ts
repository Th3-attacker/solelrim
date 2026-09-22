"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { socialLinkSchema } from "@/lib/validation/settings";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";

export async function createSocialLink(input: unknown) {
  const { productType } = await requireWritableAdminScope();
  const parsed = socialLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const maxPosition = await prisma.socialLink.aggregate({
    where: { productType },
    _max: { position: true },
  });

  const link = await prisma.socialLink.create({
    data: {
      ...parsed.data,
      productType,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { link };
}

export async function updateSocialLink(id: string, input: unknown) {
  const { productType } = await requireWritableAdminScope();
  const parsed = socialLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const updated = await prisma.socialLink.updateMany({
    where: { id, productType },
    data: parsed.data,
  });
  if (updated.count === 0) {
    return { error: "notFound" as const };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function deleteSocialLink(id: string) {
  const { productType } = await requireWritableAdminScope();

  const deleted = await prisma.socialLink.deleteMany({ where: { id, productType } });
  if (deleted.count === 0) {
    return { error: "notFound" as const };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function moveSocialLink(id: string, direction: "up" | "down") {
  const { productType } = await requireWritableAdminScope();

  const links = await prisma.socialLink.findMany({
    where: { productType },
    orderBy: { position: "asc" },
  });
  const index = links.findIndex((l) => l.id === id);
  if (index === -1) {
    return { error: "notFound" as const };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= links.length) {
    return {};
  }

  const a = links[index];
  const b = links[swapIndex];
  await prisma.$transaction([
    prisma.socialLink.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.socialLink.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}
