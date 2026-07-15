import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActiveProductById, getAdjacentProductIds } from "@/lib/queries/shop";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getPriceRange, getVariantPrice } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import { formatPrice } from "@/lib/format/currency";
import { VariantPicker } from "@/components/shop/variant-picker";
import { ProductGallery } from "@/components/shop/product-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const [t, tCommon, product] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getActiveProductById(productId),
  ]);

  if (!product) {
    notFound();
  }

  const { prevId, nextId } = await getAdjacentProductIds(
    product.categoryId,
    product.id,
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
          <Link href="/" className="hover:text-foreground">
            {t("siteName")}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={{ pathname: "/", query: { category: product.categoryId } }}
            className="hover:text-foreground"
          >
            {product.category.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {prevId ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link href={`/products/${prevId}`} aria-label={t("previousProduct")}>
                <ChevronLeft className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
          )}
          {nextId ? (
            <Button asChild variant="outline" size="icon-sm">
              <Link href={`/products/${nextId}`} aria-label={t("nextProduct")}>
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
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>

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

          <p className="text-xl font-semibold">
            {isRange && (
              <span className="me-1 text-sm font-normal text-muted-foreground">
                {t("startingFrom")}
              </span>
            )}
            {formatPrice(min, tCommon("currency"))}
          </p>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          <div className="mt-4">
            <VariantPicker
              productId={product.id}
              productName={product.name}
              imageStoragePath={product.images[0]?.storagePath ?? null}
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
