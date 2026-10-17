"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/components/shop/favorites-provider";
import { getFavoriteProducts, type FavoriteProductSummary } from "@/lib/actions/favorites";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StateMessage } from "@/components/ui/state-message";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import { formatPrice } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import { Heart } from "@phosphor-icons/react/dist/ssr";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

export function FavoritesTrigger({
  productType,
  basePath,
}: {
  productType: string;
  basePath: string;
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const side = isMobile ? "bottom" : getDirection(locale) === "rtl" ? "left" : "right";
  const { ids, hydrated, toggleFavorite } = useFavorites();

  // Resolved when the drawer is opened (and kept in step with the list), not
  // shipped with every page.
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<FavoriteProductSummary[]>([]);
  const idsKey = ids.join(",");
  useEffect(() => {
    if (!open || !hydrated) return;
    let current = true;
    getFavoriteProducts(productType, ids).then((found) => {
      if (current) setProducts(found);
    });
    return () => {
      current = false;
    };
    // idsKey stands for ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hydrated, productType, idsKey]);

  const favoriteProducts = products.filter((p) => ids.includes(p.id));
  const count = hydrated ? ids.length : 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("favoritesTitle")}>
          <Heart className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={side}
        showHandle={side === "bottom"}
        className={cn(
          "flex flex-col gap-0",
          side === "bottom" && "max-h-[85svh] rounded-t-2xl py-4",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("favoritesTitle")}</SheetTitle>
        </SheetHeader>

        {!hydrated || favoriteProducts.length === 0 ? (
          <StateMessage icon={Heart} title={t("noFavorites")} />
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <div className="flex flex-col gap-4">
              {favoriteProducts.map((product) => (
                <div key={product.id} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-card">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-1">
                    <SheetClose asChild>
                      <Link
                        href={`${basePath}/products/${product.slug}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </SheetClose>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(product.price, tCommon("currency"))}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 self-start"
                    aria-label={t("removeFromFavorites")}
                    onClick={() => toggleFavorite(product.id)}
                  >
                    <Heart weight="fill" className="size-3 fill-destructive text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
