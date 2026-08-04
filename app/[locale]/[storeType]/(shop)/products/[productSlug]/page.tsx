import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getActiveProductBySlug,
  getAdjacentProductSlugs,
  getProductSlugById,
} from "@/lib/queries/shop";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getPriceRange, getVariantPrice } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import { VariantPicker } from "@/components/shop/variant-picker";
import { ProductGallery } from "@/components/shop/product-gallery";
import { Price } from "@/components/shop/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeType: string; productSlug: string }>;
}) {
  const { storeType, productSlug } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
  ]);
  const productType = storeType;
  const product = await getActiveProductBySlug(productSlug, productType);

  if (!product) {
    // Pre-slug links shared as the raw cuid still land here — redirect to
    // the canonical slug URL instead of a dead end.
    const legacy = await getProductSlugById(productSlug);
    if (legacy) {
      const locale = await getLocale();
      redirect({ href: `/${storeType}/products/${legacy.slug}`, locale });
    }
    notFound();
  }

  const { prevSlug, nextSlug } = await getAdjacentProductSlugs(
    product.categoryId,
    product.id,
    productType,
  );

  const { min, isRange } = getPriceRange(product.variants, product.basePrice);
  const promo = isPromo(product.compareAtPrice, min);
  const images = product.images.map((image) => ({
    id: image.id,
    url: getProductImageUrl(image.storagePath),
  }));

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Link href={`/${storeType}`} className="hover:text-foreground">
            {t("siteName")}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={{
              pathname: `/${storeType}/products`,
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
                href={`/${storeType}/products/${prevSlug}`}
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
                href={`/${storeType}/products/${nextSlug}`}
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

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={images} productName={product.name} />

        <div className="flex flex-col gap-2">
          <h1 className="text-heading-sm">{product.name}</h1>

          {(promo || isNewProduct(product.createdAt) || product.isFeatured) && (
            <div className="flex flex-wrap gap-1">
              {promo && (
                <Badge className="border-0 bg-foreground text-background">
                  {t("promoBadge")}
                </Badge>
              )}
              {isNewProduct(product.createdAt) && (
                <Badge variant="outline">{t("newBadge")}</Badge>
              )}
              {product.isFeatured && (
                <Badge variant="outline">{t("bestSellerBadge")}</Badge>
              )}
            </div>
          )}

          <p className="flex items-baseline gap-1">
            {isRange && (
              <span className="text-sm font-normal text-muted-foreground">
                {t("startingFrom")}
              </span>
            )}
            <Price value={min} currency={tCommon("currency")} size="lg" />
          </p>

          {product.description && (
            <p className="text-paragraph-sm text-muted-foreground">{product.description}</p>
          )}

          <div className="mt-4">
            <VariantPicker
              productId={product.id}
              productName={product.name}
              imageStoragePath={product.images[0]?.storagePath ?? null}
              productType={productType}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                size: variant.size,
                color: variant.color,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold,
                price: getVariantPrice(variant, product.basePrice),
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
