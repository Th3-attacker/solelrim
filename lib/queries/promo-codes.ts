import { prisma } from "@/lib/prisma";

export function getAllPromoCodes(productType: string) {
  return prisma.promoCode.findMany({
    where: { productType },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}
