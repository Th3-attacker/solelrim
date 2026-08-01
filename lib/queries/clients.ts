import { prisma } from "@/lib/prisma";

export function getAllClients(productType: string) {
  return prisma.client.findMany({
    where: { productType },
    orderBy: { createdAt: "desc" },
  });
}

export function getClientById(id: string, productType: string) {
  return prisma.client.findFirst({
    where: { id, productType },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
}
