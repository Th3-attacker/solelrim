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

export async function moveCategory(id: string, direction: "up" | "down") {
  const { admin, productType } = await requireAdminScope();

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return { error: "notFound" as const };
  }
  if (admin.role === "BOUTIQUE_ADMIN" && category.productType !== productType) {
    return { error: "forbidden" as const };
  }

  // Siblings share the same scope as the category being moved (its own
  // productType — including null for a generic one), never the acting
  // admin's: a superadmin moving a generic category reorders it among the
  // other generic ones, not among whichever boutique they're currently
  // scoped to.
  const siblings = await prisma.category.findMany({
    where: { productType: category.productType },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const index = siblings.findIndex((c) => c.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) {
    return {};
  }

  // Reassigns every sibling's position to its new array index rather than
  // swapping two values — positions all start at the same default (0), so
  // a plain value-swap between two ties would be a no-op on first use.
  [siblings[index], siblings[swapIndex]] = [siblings[swapIndex], siblings[index]];
  await prisma.$transaction(
    siblings.map((sibling, i) =>
      prisma.category.update({ where: { id: sibling.id }, data: { position: i } }),
    ),
  );

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return {};
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
