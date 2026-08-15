import { prisma } from "@/lib/prisma";

export const PRODUCTS_PAGE_SIZE = 50;

export async function getAllProducts(
  productType: string,
  filters: { search?: string; categoryId?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    productType,
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        {
          variants: {
            some: { sku: { contains: filters.search, mode: "insensitive" as const } },
          },
        },
      ],
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PRODUCTS_PAGE_SIZE,
      take: PRODUCTS_PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page };
}

export function getProductById(id: string, productType: string) {
  return prisma.product.findFirst({
    where: { id, productType },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });
}

export function getAllCategories(activeProductType?: string) {
  return prisma.category.findMany({
    where: activeProductType
      ? { OR: [{ productType: null }, { productType: activeProductType }] }
      : undefined,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}
