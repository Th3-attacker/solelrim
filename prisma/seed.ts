import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OLD_DATE = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

async function upsertCategory(name: string) {
  return prisma.category.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertProduct(data: {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  compareAtPrice?: number;
  isFeatured?: boolean;
  createdAt?: Date;
  categoryId: string;
  variants: {
    size: string;
    color: string;
    sku: string;
    stock: number;
    lowStockThreshold?: number;
  }[];
}) {
  const { id, variants, ...rest } = data;
  await prisma.product.upsert({
    where: { id },
    update: rest,
    create: {
      id,
      ...rest,
      variants: {
        create: variants.map((v) => ({
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold ?? 5,
        })),
      },
    },
  });
}

async function main() {
  const running = await upsertCategory("Running");
  const football = await upsertCategory("Football");
  const fitness = await upsertCategory("Fitness");
  const basketball = await upsertCategory("Basketball");
  const accessoires = await upsertCategory("Accessoires");

  await upsertProduct({
    id: "seed-product-1",
    name: "Air Runner Pro",
    description: "Chaussure de running légère et respirante.",
    basePrice: 79.99,
    compareAtPrice: 99.99,
    isFeatured: true,
    categoryId: running.id,
    variants: [
      { size: "42", color: "Noir", sku: "AR-PRO-42-BLK", stock: 12 },
      { size: "43", color: "Noir", sku: "AR-PRO-43-BLK", stock: 3 },
      { size: "44", color: "Blanc", sku: "AR-PRO-44-WHT", stock: 0 },
    ],
  });

  await upsertProduct({
    id: "seed-product-2",
    name: "Trail Blazer X",
    description: "Chaussure de trail robuste, adhérence maximale.",
    basePrice: 89.99,
    createdAt: OLD_DATE,
    categoryId: running.id,
    variants: [
      { size: "40", color: "Gris", sku: "TB-X-40-GRY", stock: 8 },
      { size: "41", color: "Gris", sku: "TB-X-41-GRY", stock: 8 },
      { size: "42", color: "Bleu", sku: "TB-X-42-BLU", stock: 6 },
    ],
  });

  await upsertProduct({
    id: "seed-product-3",
    name: "Strike Cleats Elite",
    description: "Crampons de football pour terrain sec, touche précise.",
    basePrice: 54.99,
    compareAtPrice: 65.0,
    isFeatured: true,
    categoryId: football.id,
    variants: [
      { size: "40", color: "Noir", sku: "SC-EL-40-BLK", stock: 10 },
      { size: "41", color: "Noir", sku: "SC-EL-41-BLK", stock: 2 },
      { size: "42", color: "Rouge", sku: "SC-EL-42-RED", stock: 0 },
    ],
  });

  await upsertProduct({
    id: "seed-product-4",
    name: "Match Ball Pro",
    description: "Ballon de match officiel, cousu main.",
    basePrice: 34.99,
    createdAt: OLD_DATE,
    categoryId: football.id,
    variants: [{ size: "Unique", color: "Blanc", sku: "MB-PRO-U-WHT", stock: 20 }],
  });

  await upsertProduct({
    id: "seed-product-5",
    name: "Flex Training Tee",
    description: "T-shirt technique respirant pour l'entraînement.",
    basePrice: 24.99,
    isFeatured: true,
    categoryId: fitness.id,
    variants: [
      { size: "S", color: "Noir", sku: "FT-TEE-S-BLK", stock: 15 },
      { size: "M", color: "Noir", sku: "FT-TEE-M-BLK", stock: 15 },
      { size: "L", color: "Gris", sku: "FT-TEE-L-GRY", stock: 1 },
    ],
  });

  await upsertProduct({
    id: "seed-product-6",
    name: "Power Leggings",
    description: "Legging compressif haute taille pour le fitness.",
    basePrice: 34.99,
    compareAtPrice: 45.0,
    categoryId: fitness.id,
    variants: [
      { size: "S", color: "Noir", sku: "PL-S-BLK", stock: 10 },
      { size: "M", color: "Noir", sku: "PL-M-BLK", stock: 10 },
      { size: "L", color: "Noir", sku: "PL-L-BLK", stock: 10 },
    ],
  });

  await upsertProduct({
    id: "seed-product-7",
    name: "Grip Training Gloves",
    description: "Gants de musculation avec grip renforcé.",
    basePrice: 19.99,
    createdAt: OLD_DATE,
    categoryId: fitness.id,
    variants: [
      { size: "M", color: "Noir", sku: "GTG-M-BLK", stock: 5 },
      { size: "L", color: "Noir", sku: "GTG-L-BLK", stock: 5 },
    ],
  });

  await upsertProduct({
    id: "seed-product-8",
    name: "Hoop Legend High-Tops",
    description: "Chaussure de basketball montante, amorti réactif.",
    basePrice: 94.99,
    compareAtPrice: 120.0,
    isFeatured: true,
    categoryId: basketball.id,
    variants: [
      { size: "42", color: "Blanc", sku: "HL-HT-42-WHT", stock: 7 },
      { size: "43", color: "Blanc", sku: "HL-HT-43-WHT", stock: 7 },
      { size: "44", color: "Noir", sku: "HL-HT-44-BLK", stock: 0 },
    ],
  });

  await upsertProduct({
    id: "seed-product-9",
    name: "Court Jersey",
    description: "Maillot de basketball respirant, coupe libre.",
    basePrice: 29.99,
    createdAt: OLD_DATE,
    categoryId: basketball.id,
    variants: [
      { size: "M", color: "Bleu", sku: "CJ-M-BLU", stock: 12 },
      { size: "L", color: "Bleu", sku: "CJ-L-BLU", stock: 12 },
    ],
  });

  await upsertProduct({
    id: "seed-product-10",
    name: "Performance Cap",
    description: "Casquette légère et ajustable.",
    basePrice: 14.99,
    createdAt: OLD_DATE,
    categoryId: accessoires.id,
    variants: [{ size: "Unique", color: "Noir", sku: "PC-U-BLK", stock: 25 }],
  });

  await upsertProduct({
    id: "seed-product-11",
    name: "Sport Duffel Bag",
    description: "Sac de sport spacieux avec compartiment chaussures.",
    basePrice: 39.99,
    isFeatured: true,
    categoryId: accessoires.id,
    variants: [{ size: "Unique", color: "Gris", sku: "SDB-U-GRY", stock: 8 }],
  });

  await upsertProduct({
    id: "seed-product-12",
    name: "Compression Socks",
    description: "Chaussettes de compression pour une meilleure récupération.",
    basePrice: 11.99,
    compareAtPrice: 15.0,
    categoryId: accessoires.id,
    variants: [{ size: "Unique", color: "Noir", sku: "CS-U-BLK", stock: 30 }],
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
