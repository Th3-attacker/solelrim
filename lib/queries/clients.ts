import { prisma } from "@/lib/prisma";

export function getAllClients(productType: string) {
  return prisma.client.findMany({
    where: { productType },
    orderBy: { createdAt: "desc" },
  });
}

export const CLIENTS_PAGE_SIZE = 50;

// Separate from getAllClients — that one backs client-picker dropdowns
// (promo codes, new sale) that need the full list, not a filtered page.
export async function getClientsPage(
  productType: string,
  filters: { search?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    productType,
    ...(filters.search && {
      OR: [
        { fullName: { contains: filters.search, mode: "insensitive" as const } },
        { phone: { contains: filters.search } },
      ],
    }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CLIENTS_PAGE_SIZE,
      take: CLIENTS_PAGE_SIZE,
    }),
    prisma.client.count({ where }),
  ]);

  return { clients, total, page };
}

export function getClientById(id: string, productType: string) {
  return prisma.client.findFirst({
    where: { id, productType },
  });
}

export const CLIENT_SALES_PAGE_SIZE = 20;

// Separate from getClientById — a loyal client's purchase history can grow
// past a single page, so it's fetched (and paginated) independently rather
// than as an unbounded include on the client record.
export async function getClientSalesPage(
  clientId: string,
  productType: string,
  page = 1,
) {
  const currentPage = Math.max(1, page);
  const where = { clientId, productType };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true },
      skip: (currentPage - 1) * CLIENT_SALES_PAGE_SIZE,
      take: CLIENT_SALES_PAGE_SIZE,
    }),
    prisma.sale.count({ where }),
  ]);

  return { sales, total, page: currentPage };
}
