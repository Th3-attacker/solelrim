import { prisma } from "@/lib/prisma";
import { getProductImageUrl } from "@/lib/supabase/storage";

// The whole active catalog at once: a boutique's catalog is small, and
// shipping it in one go lets the checkout search instantly on the device
// instead of a server round trip per keystroke at the counter. Prices are
// resolved here (variant price, else the product's base price) and are
// display-only — createPosSale recomputes them from the database.
export async function getPosCatalog(productType: string) {
  const products = await prisma.product.findMany({
    where: { productType, isActive: true },
    include: {
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      images: { orderBy: { position: "asc" }, take: 1 },
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category.name,
    imageUrl: product.images[0] ? getProductImageUrl(product.images[0].storagePath) : null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      stock: variant.stock,
      price: (variant.price ?? product.basePrice).toNumber(),
    })),
  }));
}

export function getPosWallets(productType: string) {
  return prisma.walletAccount.findMany({
    where: { productType },
    orderBy: { position: "asc" },
    select: { id: true, provider: true, number: true },
  });
}

export type PosProduct = Awaited<ReturnType<typeof getPosCatalog>>[number];
export type PosWallet = Awaited<ReturnType<typeof getPosWallets>>[number];
