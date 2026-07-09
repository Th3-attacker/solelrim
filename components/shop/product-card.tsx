import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { StockBadge } from "@/components/shop/stock-badge";
import { Badge } from "@/components/ui/badge";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getAggregateStockStatus } from "@/lib/shop/stock";
import { getPriceRange } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("shop");
  const image = product.images[0];
  const status = getAggregateStockStatus(product.variants);
  const { min, isRange } = getPriceRange(product.variants, product.basePrice);
  const promo = isPromo(product.compareAtPrice, min);

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <Card className="h-full overflow-hidden gap-3 py-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {image ? (
            <Image
              src={getProductImageUrl(image.storagePath)}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Solelrim
            </div>
          )}
          <div className="absolute start-2 top-2 flex flex-col gap-1">
            {promo && <Badge className="shadow-sm">{t("promoBadge")}</Badge>}
            {product.isFeatured && (
              <Badge variant="secondary" className="shadow-sm">
                {t("bestSellerBadge")}
              </Badge>
            )}
            {isNewProduct(product.createdAt) && (
              <Badge variant="outline" className="border-foreground/20 bg-background/80 shadow-sm">
                {t("newBadge")}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="px-3">
          <p className="text-xs text-muted-foreground">
            {product.category.name}
          </p>
          <p className="truncate text-sm font-medium">{product.name}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between px-3 pb-3">
          <p className="text-sm">
            {isRange && (
              <span className="text-muted-foreground">{t("startingFrom")} </span>
            )}
            {promo && (
              <span className="me-1 text-muted-foreground line-through">
                {product.compareAtPrice?.toFixed(2)}
              </span>
            )}
            <span className="font-semibold text-primary">{min.toFixed(2)}</span>
          </p>
          <StockBadge status={status} />
        </CardFooter>
      </Card>
    </Link>
  );
}
