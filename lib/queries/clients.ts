import { prisma } from "@/lib/prisma";

export function getAllClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
}
