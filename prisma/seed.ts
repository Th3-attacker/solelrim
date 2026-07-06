import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const category = await prisma.category.upsert({
    where: { name: "Running" },
    update: {},
    create: { name: "Running" },
  });

  await prisma.product.upsert({
    where: { id: "seed-product-1" },
    update: {},
    create: {
      id: "seed-product-1",
      name: "Air Runner Pro",
      description: "Chaussure de running légère et respirante.",
      basePrice: 79.99,
      categoryId: category.id,
      variants: {
        create: [
          { size: "42", color: "Noir", sku: "AR-PRO-42-BLK", stock: 12, lowStockThreshold: 5 },
          { size: "43", color: "Noir", sku: "AR-PRO-43-BLK", stock: 3, lowStockThreshold: 5 },
          { size: "44", color: "Blanc", sku: "AR-PRO-44-WHT", stock: 0, lowStockThreshold: 5 },
        ],
      },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
