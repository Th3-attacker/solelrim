import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductImageUrl, getStoreLogoUrl } from "@/lib/supabase/storage";

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

// Everything a printed/WhatsApp receipt shows. Scoped by productType, so a
// sale id from another boutique resolves to null (a 404), never its data.
export async function getReceipt(saleId: string, productType: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, productType },
    include: {
      items: {
        include: {
          variant: { select: { size: true, color: true, product: { select: { name: true } } } },
        },
      },
      seller: { select: { supabaseUserId: true, role: true } },
      storeType: {
        select: {
          label: true,
          siteName: true,
          siteNameAr: true,
          siteNameEn: true,
          adminWhatsappNumber: true,
          logoStoragePath: true,
        },
      },
    },
  });
  if (!sale) return null;

  // Only a SELLER is named, never a boutique admin or superadmin who rang a
  // sale up — their login handle has no business on a customer receipt.
  // Sellers have no display name of their own, so the part of their email
  // before "@" is the handle shown, never the full address.
  let sellerLabel: string | null = null;
  if (sale.seller?.role === "SELLER") {
    const { data, error } = await createAdminClient().auth.admin.getUserById(
      sale.seller.supabaseUserId,
    );
    if (error) {
      console.error("[getReceipt] seller lookup failed", error);
    }
    sellerLabel = data.user?.email?.split("@")[0] ?? null;
  }

  return {
    reference: sale.reference,
    createdAt: sale.createdAt,
    status: sale.status,
    subtotal: sale.subtotal.toNumber(),
    discount: sale.discount.toNumber(),
    total: sale.total.toNumber(),
    paymentMethod: sale.paymentMethod,
    walletProvider: sale.walletProvider,
    amountReceived: sale.amountReceived?.toNumber() ?? null,
    sellerLabel,
    boutique: {
      ...sale.storeType,
      logoUrl: sale.storeType.logoStoragePath
        ? getStoreLogoUrl(sale.storeType.logoStoragePath)
        : null,
    },
    lines: sale.items.map((item) => ({
      productName: item.variant.product.name,
      size: item.variant.size,
      color: item.variant.color,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
    })),
  };
}

export type PosProduct = Awaited<ReturnType<typeof getPosCatalog>>[number];
export type PosWallet = Awaited<ReturnType<typeof getPosWallets>>[number];
