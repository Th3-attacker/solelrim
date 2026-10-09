import { getProductImageUrl, getStoreHeroImageUrl, getStoreLogoUrl, getWalletLogoUrl } from "@/lib/supabase/storage";
import { getPriceRange, getVariantPrice } from "@/lib/shop/price";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { resolveStoreTheme } from "@/lib/theme/presets";
import { findWalletProvider, walletLogoSrc } from "@/lib/shop/wallet-providers";
import { lookupSwatchHexes } from "@/lib/shop/color-swatch";
import type { OpenBoutique } from "@/lib/api/boutique";
import type { Prisma } from "@/lib/generated/prisma/client";

// What the app is allowed to see. Each shape is built field by field, never
// by spreading a database row, so a column added to the schema later (a cost,
// an internal note) can't leak into the public API by accident.

type ProductRow = Prisma.ProductGetPayload<{
  include: { category: true; images: true; variants: true };
}>;

export function serializeBoutique(boutique: OpenBoutique, locale: string, origin: string) {
  const text = resolveBoutiqueText(boutique, locale);
  const theme = resolveStoreTheme(boutique);
  return {
    key: boutique.key,
    name: text.siteName ?? boutique.label,
    announcement: boutique.announcementText?.trim() || null,
    logoUrl: boutique.logoStoragePath ? getStoreLogoUrl(boutique.logoStoragePath) : null,
    heroImageUrl: boutique.heroImagePath ? getStoreHeroImageUrl(boutique.heroImagePath) : null,
    heroTitle: text.heroTitle,
    heroSubtitle: text.heroSubtitle,
    heroCtaLabel: boutique.heroCtaLabel,
    theme: { id: theme.id, colorMode: boutique.colorMode, light: theme.light, dark: theme.dark },
    couponsEnabled: boutique.couponsEnabled,
    payment: {
      instructions: boutique.paymentInstructions,
      whatsappNumber: boutique.adminWhatsappNumber,
      wallets: boutique.walletAccounts.map((wallet) => {
        const bundled = walletLogoSrc(wallet.provider, null);
        const uploaded = wallet.logoStoragePath ? getWalletLogoUrl(wallet.logoStoragePath) : null;
        return {
          // Stable across edits: the app keys its list by it, so a wallet the
          // admin renames or re-orders stays the same row.
          id: wallet.id,
          provider: wallet.provider,
          // The app can ship its own logo for a known provider; logoUrl is
          // for the others (and a fallback).
          providerKey: findWalletProvider(wallet.provider)?.key ?? null,
          number: wallet.number,
          logoUrl: bundled ? new URL(bundled, origin).toString() : uploaded,
        };
      }),
    },
    socialLinks: boutique.socialLinks.map((link) => ({ platform: link.platform, url: link.url })),
  };
}

// Distinct variant colors in the order they were entered — re-sorted here
// because the product page gets its variants in size order. Exact strings:
// "Noir" and "noir" are two colors, as they are for the variants themselves.
function distinctColors(variants: ProductRow["variants"]) {
  const entryOrder = [...variants].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return [...new Set(entryOrder.map((variant) => variant.color))];
}

// The website's swatch lookup (lib/shop/color-swatch.ts), so the app shows the
// same dots. One hex per hyphen segment ("Noir-Blanc"); null where the name
// isn't known, for the app to pick its own fallback.
function serializeColorSwatch(name: string) {
  const hexes = lookupSwatchHexes(name);
  return { name, hex: hexes[0] ?? null, hexes };
}

export function serializeProductSummary(product: ProductRow) {
  const price = getPriceRange(product.variants, product.basePrice);
  const colors = distinctColors(product.variants);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: { id: product.category.id, name: product.category.name },
    imageUrl: product.images[0] ? getProductImageUrl(product.images[0].storagePath) : null,
    price: { min: price.min, max: price.max },
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
    isFeatured: product.isFeatured,
    inStock: product.variants.some((variant) => variant.stock > 0),
    colors,
    colorsInStock: distinctColors(product.variants.filter((variant) => variant.stock > 0)),
    colorSwatches: colors.map(serializeColorSwatch),
  };
}

export function serializeProductDetail(product: ProductRow) {
  return {
    ...serializeProductSummary(product),
    description: product.description,
    images: product.images.map((image) => ({
      url: getProductImageUrl(image.storagePath),
      color: image.color ?? null,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      price: getVariantPrice(variant, product.basePrice),
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
    })),
  };
}
