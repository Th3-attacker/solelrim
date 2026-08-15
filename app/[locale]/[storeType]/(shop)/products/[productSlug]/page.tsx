import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getActiveProductBySlug,
  getAdjacentProductSlugs,
  getProductSlugById,
} from "@/lib/queries/shop";
import { getPublicBoutiqueSettings } from "@/lib/queries/settings";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getVariantPrice } from "@/lib/shop/price";
import { isNewProduct } from "@/lib/shop/badges";
import { buildSocialMetadata } from "@/lib/shop/metadata";
import { getStorefrontBasePath } from "@/lib/shop/storefront-path";
import { resolveBoutiqueText } from "@/lib/shop/localized-boutique-text";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeType: string; productSlug: string }>;
}): Promise<Metadata> {
  const { storeType, productSlug } = await params;
  const [tShop, locale, boutique, product] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    getPublicBoutiqueSettings(storeType),
    getActiveProductBySlug(productSlug, storeType),
  ]);

  if (!product) {
    return {};
  }

  const siteName = resolveBoutiqueText(boutique, locale).siteName?.trim() || tShop("siteName");
  const title = `${product.name} — ${siteName}`;
  const description = product.description?.trim() || tShop("heroSubtitle");
  const imageUrl = product.images[0]
    ? getProductImageUrl(product.images[0].storagePath)
    : null;

  return {
    title,
    description,
    ...buildSocialMetadata({ title, description, imageUrl, locale }),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeType: string; productSlug: string }>;
}) {
  const { storeType, productSlug } = await params;
  const [t, basePath] = await Promise.all([
    getTranslations("shop"),
    getStorefrontBasePath(storeType),
  ]);
  const productType = storeType;
  const product = await getActiveProductBySlug(productSlug, productType);

  if (!product) {
    // Pre-slug links shared as the raw cuid still land here — redirect to
    // the canonical slug URL instead of a dead end.
    const legacy = await getProductSlugById(productSlug);
    if (legacy) {
      const locale = await getLocale();
      redirect({ href: `${basePath}/products/${legacy.slug}`, locale });
    }
    notFound();
  }

  const { prevSlug, nextSlug } = await getAdjacentProductSlugs(
    product.categoryId,
    product.id,
    productType,
  );

  const images = product.images.map((image) => ({
    id: image.id,
    url: getProductImageUrl(image.storagePath),
    storagePath: image.storagePath,
    color: image.color,
  }));
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
    lowStockThreshold: variant.lowStockThreshold,
    price: getVariantPrice(variant, product.basePrice),
  }));

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Link href={basePath || "/"} className="hover:text-foreground">
            {t("siteName")}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={{
              pathname: `${basePath}/products`,
              query: { category: product.categoryId },
            }}
            className="hover:text-foreground"
          >
            {product.category.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {prevSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link
                href={`${basePath}/products/${prevSlug}`}
                aria-label={t("previousProduct")}
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
          )}
          {nextSlug ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link
                href={`${basePath}/products/${nextSlug}`}
                aria-label={t("nextProduct")}
              >
                <ChevronRight className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          )}
        </div>
      </nav>

      <ProductDetailView
        productId={product.id}
        productName={product.name}
        productType={productType}
        description={product.description}
        basePrice={product.basePrice.toNumber()}
        compareAtPrice={product.compareAtPrice?.toNumber() ?? null}
        isNew={isNewProduct(product.createdAt)}
        isFeatured={product.isFeatured}
        images={images}
        variants={variants}
      />
    </div>
  );
}
