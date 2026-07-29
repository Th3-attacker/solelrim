"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/components/shop/favorites-provider";
import { Button } from "@/components/ui/button";

// Same page size at every breakpoint — it's a multiple of 2, 3, and 4, so it
// fills a whole row of the grid below (2 cols mobile / 3 tablet / 4 desktop)
// instead of ending on a half-empty row.
const PAGE_SIZE = 12;

export function FavoritesSortedGrid({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode[];
}) {
  const { isFavorite, hydrated } = useFavorites();
  const t = useTranslations("shop");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const ordered = useMemo(() => {
    const pairs = ids.map((id, index) => ({ id, node: children[index] }));
    if (!hydrated) return pairs;
    // Array.prototype.sort is stable, so favorites keep their relative order.
    return [...pairs].sort(
      (a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)),
    );
  }, [ids, children, hydrated, isFavorite]);

  // A new filter/sort/search hands us a different id list — start capped
  // again instead of keeping whatever page the previous list was on. Adjusted
  // during render (React's documented pattern for this) rather than in a
  // useEffect, so it takes effect before the over-long list ever paints.
  const [prevIdsKey, setPrevIdsKey] = useState(ids.join("|"));
  const idsKey = ids.join("|");
  if (idsKey !== prevIdsKey) {
    setPrevIdsKey(idsKey);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = ordered.slice(0, visibleCount);
  const hasMore = visibleCount < ordered.length;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
        {visible.map((item) => (
          <div key={item.id}>{item.node}</div>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="outline"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
