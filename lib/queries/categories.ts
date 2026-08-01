import { prisma } from "@/lib/prisma";

// Same generic-OR-scoped shape as getAllCategories (lib/queries/products.ts,
// used by the product form's picker), kept separate since this one needs
// the boutique label and product count for the admin list, not just id/name.
export function getCategoriesForAdmin(scopeFilter?: string) {
  return prisma.category.findMany({
    where: scopeFilter
      ? { OR: [{ productType: null }, { productType: scopeFilter }] }
      : undefined,
    include: {
      storeType: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });
}
