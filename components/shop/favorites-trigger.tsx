"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getDirection } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useFavorites } from "@/components/shop/favorites-provider";
import { formatPrice } from "@/lib/format/currency";

export type FavoriteProductSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
};

export function FavoritesTrigger({
  products,
}: {
  products: FavoriteProductSummary[];
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const side = getDirection(locale) === "rtl" ? "left" : "right";
  const { ids, hydrated, toggleFavorite } = useFavorites();

  const favoriteProducts = products.filter((p) => ids.includes(p.id));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Heart className="size-4" />
          {hydrated && favoriteProducts.length > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {favoriteProducts.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{t("favoritesTitle")}</SheetTitle>
        </SheetHeader>

        {!hydrated || favoriteProducts.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">{t("noFavorites")}</p>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <div className="flex flex-col gap-4">
              {favoriteProducts.map((product) => (
                <div key={product.id} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
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
                        href={`/products/${product.id}`}
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
                    <Heart className="size-3 fill-destructive text-destructive" />
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
