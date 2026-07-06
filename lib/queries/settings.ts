import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getStoreSettings = cache(function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
});
