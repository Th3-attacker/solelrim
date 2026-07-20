import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StockBadge } from "@/components/shop/stock-badge";
import { FavoriteButton } from "@/components/shop/favorite-button";
import { Price } from "@/components/shop/price";
import { Badge } from "@/components/ui/badge";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { getAggregateStockStatus } from "@/lib/shop/stock";
import { getPriceRange } from "@/lib/shop/price";
import { isNewProduct, isPromo } from "@/lib/shop/badges";
import { formatPrice } from "@/lib/format/currency";
import { getSwatchStyle } from "@/lib/shop/color-swatch";
import { cn } from "@/lib/utils";
import type { getActiveProducts } from "@/lib/queries/shop";

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

const MAX_SWATCHES = 4;

export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const image = product.images[0];
  const status = getAggregateStockStatus(product.variants);
  const { min, isRange } = getPriceRange(product.variants, product.basePrice);
  const promo = isPromo(product.compareAtPrice, min);
  const isNew = isNewProduct(product.createdAt);
  const discountPercent =
    promo && product.compareAtPrice
      ? Math.round((1 - min / product.compareAtPrice.toNumber()) * 100)
      : null;

  const badges = (
    [
      promo && discountPercent
        ? { key: "promo", label: `-${discountPercent}%` }
        : null,
      isNew ? { key: "new", label: t("newBadge") } : null,
      !promo && !isNew && product.isFeatured
        ? { key: "featured", label: t("bestSellerBadge") }
        : null,
    ] as const
  )
    .filter((b): b is Exclude<typeof b, null> => b !== null)
    .slice(0, 2);

  const colors = [...new Set(product.variants.map((v) => v.color))];
  const isOutOfStock = status === "out";

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-2xl bg-muted p-4 transition-all duration-300",
        isOutOfStock ? "opacity-60" : "hover:-translate-y-1 hover:shadow-md",
      )}
    >
      <div className="relative aspect-square w-full">
        {image ? (
          <Image
            src={getProductImageUrl(image.storagePath)}
            alt={product.name}
            fill
            className={cn(
              "object-contain p-4 transition-transform duration-500",
              isOutOfStock ? "grayscale" : "group-hover:scale-105",
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Solelrim
          </div>
        )}

        {badges.length > 0 && (
          <div className="pointer-events-none absolute end-0 top-0 flex flex-col items-end gap-1">
            {badges.map((badge) => (
              <Badge
                key={badge.key}
                dir={badge.key === "promo" ? "ltr" : undefined}
                className="border-0 bg-background text-foreground shadow-sm"
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {/* Stretched-link pattern: the anchor only wraps the product name
              (valid HTML), but its ::after pseudo-element covers the whole
              card, so the entire card is still clickable. FavoriteButton
              sits as a real sibling above it (z-10), not nested inside an
              <a> — that combination is invalid HTML and made click targeting
              unreliable. Out-of-stock products disable the card entirely:
              no ::after overlay, so nothing beneath is clickable. */}
          {isOutOfStock ? (
            <span
              aria-disabled="true"
              className="truncate text-sm text-muted-foreground"
            >
              {product.name}
            </span>
          ) : (
            <Link
              href={`/products/${product.id}`}
              className="truncate text-sm text-foreground after:absolute after:inset-0 after:content-['']"
            >
              {product.name}
            </Link>
          )}
          <FavoriteButton
            productId={product.id}
            className="relative z-10 size-7 shrink-0 bg-transparent shadow-none hover:bg-transparent"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-baseline gap-1.5 text-sm">
            {isRange && (
              <span className="text-muted-foreground">{t("startingFrom")}</span>
            )}
            {promo && product.compareAtPrice && (
              // Mixes Latin digits and the MRU currency code, which stay
              // left-to-right even on the Arabic page — isolating direction
              // here stops two adjacent amounts from getting bidi-reordered
              // into an unreadable jumble.
              <span dir="ltr" className="text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice, tCommon("currency"))}
              </span>
            )}
            <Price value={min} currency={tCommon("currency")} />
          </span>
          <StockBadge status={status} />
        </div>

        {colors.length > 1 && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {colors.slice(0, MAX_SWATCHES).map((color) => (
              <span
                key={color}
                title={color}
                className="size-3.5 rounded-full ring-1 ring-inset ring-foreground/15"
                style={getSwatchStyle(color)}
              />
            ))}
            {colors.length > MAX_SWATCHES && (
              <span className="text-xs text-muted-foreground">
                +{colors.length - MAX_SWATCHES}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
