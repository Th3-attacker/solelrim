"use client";

import { Heart } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/components/shop/favorites-provider";

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const t = useTranslations("shop");
  const { isFavorite, toggleFavorite, hydrated } = useFavorites();
  const active = hydrated && isFavorite(productId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t("removeFromFavorites") : t("addToFavorites")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(productId);
      }}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-transform hover:scale-110 hover:text-destructive",
        className,
      )}
    >
      <Heart
        weight={active ? "fill" : "regular"}
        className={cn("size-4 transition-colors", active && "fill-destructive text-destructive")}
      />
    </button>
  );
}
