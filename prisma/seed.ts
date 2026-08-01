import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { slugify } from "../lib/shop/slug";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OLD_DATE = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

// Category.name is no longer @unique in the Prisma schema (replaced by two
// partial unique indexes so different boutiques can share a name — see
// migration 20260731191000_category_partial_unique), so upsert-by-name
// isn't expressible via Prisma's `where` anymore. This seed only ever
// creates generic categories, so look one up the same way the app does.
async function upsertCategory(name: string) {
  const existing = await prisma.category.findFirst({
    where: { name, productType: null },
  });
  if (existing) return existing;
  return prisma.category.create({ data: { name } });
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
  productType?: string;
  variants: {
    size: string;
    color: string;
    sku: string;
    stock: number;
    lowStockThreshold?: number;
  }[];
}) {
  const { id, variants, productType = "sport", ...rest } = data;
  await prisma.product.upsert({
    where: { id },
    update: rest,
    create: {
      id,
      slug: slugify(rest.name),
      ...rest,
      productType,
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
  const vetements = await upsertCategory("Vêtements");

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

  // Catalogue additionnel — style aligné sur les produits réels déjà en
  // base (prix ronds en MRU, couleurs en majuscules) plutôt que sur les
  // seed-product-1..12 ci-dessus. Stocks volontairement variés (normal /
  // faible / rupture) pour continuer à couvrir le badge de stock.
  await upsertProduct({
    id: "seed-product-13",
    name: "Ultraboost Runner",
    description: "Adidas Ultraboost running shoes - confort maximal",
    basePrice: 3200,
    compareAtPrice: 3800,
    isFeatured: true,
    categoryId: running.id,
    variants: [
      { size: "40", color: "BLACK", sku: "UB-40-BLK", stock: 8, lowStockThreshold: 3 },
      { size: "41", color: "BLACK", sku: "UB-41-BLK", stock: 8, lowStockThreshold: 3 },
      { size: "42", color: "WHITE", sku: "UB-42-WHT", stock: 2, lowStockThreshold: 3 },
      { size: "43", color: "WHITE", sku: "UB-43-WHT", stock: 0, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-14",
    name: "Air Max City",
    description: "Nike Air Max, amorti quotidien",
    basePrice: 2400,
    categoryId: running.id,
    variants: [
      { size: "40", color: "BLACK-WHITE", sku: "AMC-40-BW", stock: 6, lowStockThreshold: 3 },
      { size: "41", color: "BLACK-WHITE", sku: "AMC-41-BW", stock: 6, lowStockThreshold: 3 },
      { size: "42", color: "GREY", sku: "AMC-42-GRY", stock: 4, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-15",
    name: "Maillot Domicile FC",
    description: "Maillot officiel réplique, respirant",
    basePrice: 900,
    compareAtPrice: 1200,
    isFeatured: true,
    categoryId: football.id,
    variants: [
      { size: "S", color: "RED", sku: "MDF-S-RED", stock: 10, lowStockThreshold: 4 },
      { size: "M", color: "RED", sku: "MDF-M-RED", stock: 12, lowStockThreshold: 4 },
      { size: "L", color: "RED", sku: "MDF-L-RED", stock: 3, lowStockThreshold: 4 },
      { size: "XL", color: "RED", sku: "MDF-XL-RED", stock: 0, lowStockThreshold: 4 },
    ],
  });

  await upsertProduct({
    id: "seed-product-16",
    name: "Ballon Match Pro",
    description: "Ballon de match taille 5, cousu main",
    basePrice: 700,
    categoryId: football.id,
    variants: [
      { size: "Unique", color: "WHITE-BLACK", sku: "BMP-U-WB", stock: 15, lowStockThreshold: 5 },
    ],
  });

  await upsertProduct({
    id: "seed-product-17",
    name: "Short Basketball Pro",
    description: "Short technique léger, poches zippées",
    basePrice: 650,
    categoryId: basketball.id,
    variants: [
      { size: "M", color: "BLACK", sku: "SBP-M-BLK", stock: 9, lowStockThreshold: 3 },
      { size: "L", color: "BLACK", sku: "SBP-L-BLK", stock: 9, lowStockThreshold: 3 },
      { size: "XL", color: "BLACK", sku: "SBP-XL-BLK", stock: 1, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-18",
    name: "Maillot Basketball Legend",
    description: "Maillot sans manches, coupe ample",
    basePrice: 800,
    compareAtPrice: 950,
    categoryId: basketball.id,
    variants: [
      { size: "M", color: "RED-WHITE", sku: "MBL-M-RW", stock: 6, lowStockThreshold: 3 },
      { size: "L", color: "RED-WHITE", sku: "MBL-L-RW", stock: 6, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-19",
    name: "Legging Fitness Pro",
    description: "Legging taille haute, tissu extensible",
    basePrice: 550,
    isFeatured: true,
    categoryId: fitness.id,
    variants: [
      { size: "S", color: "BLACK", sku: "LFP-S-BLK", stock: 14, lowStockThreshold: 4 },
      { size: "M", color: "BLACK", sku: "LFP-M-BLK", stock: 14, lowStockThreshold: 4 },
      { size: "L", color: "BLACK", sku: "LFP-L-BLK", stock: 2, lowStockThreshold: 4 },
    ],
  });

  await upsertProduct({
    id: "seed-product-20",
    name: "Brassière de Sport",
    description: "Brassière maintien fort, dos nageur",
    basePrice: 400,
    categoryId: fitness.id,
    variants: [
      { size: "S", color: "BLACK", sku: "BDS-S-BLK", stock: 8, lowStockThreshold: 3 },
      { size: "M", color: "BLACK", sku: "BDS-M-BLK", stock: 8, lowStockThreshold: 3 },
      { size: "L", color: "GREY", sku: "BDS-L-GRY", stock: 0, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-21",
    name: "Bandes de Résistance (Set)",
    description: "Set de 5 bandes élastiques, intensités variées",
    basePrice: 300,
    categoryId: fitness.id,
    variants: [
      { size: "Unique", color: "MULTICOLOR", sku: "BDR-U-MLT", stock: 20, lowStockThreshold: 5 },
    ],
  });

  await upsertProduct({
    id: "seed-product-22",
    name: "Hoodie Training",
    description: "Sweat à capuche molleton, coupe droite",
    basePrice: 850,
    compareAtPrice: 1000,
    categoryId: vetements.id,
    variants: [
      { size: "M", color: "BLACK", sku: "HDT-M-BLK", stock: 7, lowStockThreshold: 3 },
      { size: "L", color: "BLACK", sku: "HDT-L-BLK", stock: 7, lowStockThreshold: 3 },
      { size: "XL", color: "GREY", sku: "HDT-XL-GRY", stock: 1, lowStockThreshold: 3 },
    ],
  });

  await upsertProduct({
    id: "seed-product-23",
    name: "Casquette Performance",
    description: "Casquette ajustable, tissu respirant",
    basePrice: 200,
    categoryId: accessoires.id,
    variants: [
      { size: "Unique", color: "BLACK", sku: "CQP-U-BLK", stock: 25, lowStockThreshold: 5 },
      { size: "Unique", color: "WHITE", sku: "CQP-U-WHT", stock: 3, lowStockThreshold: 5 },
    ],
  });

  await upsertProduct({
    id: "seed-product-24",
    name: "Sac de Sport Compact",
    description: "Sac de sport avec compartiment chaussures",
    basePrice: 550,
    isFeatured: true,
    categoryId: accessoires.id,
    variants: [
      { size: "Unique", color: "BLACK", sku: "SSC-U-BLK", stock: 5, lowStockThreshold: 3 },
      { size: "Unique", color: "GREY", sku: "SSC-U-GRY", stock: 0, lowStockThreshold: 3 },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
