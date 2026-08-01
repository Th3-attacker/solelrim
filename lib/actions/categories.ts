"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validation/product";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";

export async function createCategory(name: string) {
  const { productType } = await requireAdminScope();
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name, productType },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  return { category };
}

// A boutique admin may only rename/delete categories tagged to their own
// boutique — never the generic ones (productType: null) shared across
// every boutique, since renaming/deleting those would affect other
// boutiques too.
export async function updateCategory(id: string, name: string) {
  const { admin, productType } = await requireAdminScope();
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return { error: "notFound" as const };
  }
  if (admin.role === "BOUTIQUE_ADMIN" && category.productType !== productType) {
    return { error: "forbidden" as const };
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return { category: updated };
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "duplicateName" as const };
    }
    throw err;
  }
}

export async function deleteCategory(id: string) {
  const { admin, productType } = await requireAdminScope();

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return { error: "notFound" as const };
  }
  if (admin.role === "BOUTIQUE_ADMIN" && category.productType !== productType) {
    return { error: "forbidden" as const };
  }

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return { error: "hasProducts" as const };
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  return {};
}
