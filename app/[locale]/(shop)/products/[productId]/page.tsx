import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getActiveProductById } from "@/lib/queries/shop";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getVariantPrice, getPriceRange } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import { VariantPicker } from "@/components/shop/variant-picker";
import { FavoriteButton } from "@/components/shop/favorite-button";
import { Badge } from "@/components/ui/badge";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const [t, product] = await Promise.all([
    getTranslations("shop"),
    getActiveProductById(productId),
  ]);

  if (!product) {
    notFound();
  }

  const { min } = getPriceRange(product.variants, product.basePrice);
  const promo = isPromo(product.compareAtPrice, min);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="grid gap-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {product.images[0] ? (
            <Image
              src={getProductImageUrl(product.images[0].storagePath)}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : null}
        </div>
        {product.images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {product.images.slice(1).map((image) => (
              <div
                key={image.id}
                className="relative aspect-square overflow-hidden rounded-md bg-muted"
              >
                <Image
                  src={getProductImageUrl(image.storagePath)}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{product.category.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          </div>
          <FavoriteButton productId={product.id} className="border shrink-0" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {promo && (
            <Badge className="border-0 bg-primary text-primary-foreground">
              {t("promoBadge")}
            </Badge>
          )}
          {isNewProduct(product.createdAt) && (
            <Badge className="border-0 bg-foreground text-background">
              {t("newBadge")}
            </Badge>
          )}
          {product.isFeatured && (
            <Badge variant="outline">{t("bestSellerBadge")}</Badge>
          )}
        </div>
        {product.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {product.description}
          </p>
        )}

        <div className="mt-6">
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
  );
}
