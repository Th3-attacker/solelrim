"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFavorites } from "@/components/shop/favorites-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

// Mobile gets a shorter first page (3 rows of the 2-col grid) than
// tablet/desktop (a multiple of 3 and 4 too, so it fills a whole row of
// their grids instead of ending on a half-empty one).
const MOBILE_PAGE_SIZE = 6;
const PAGE_SIZE = 12;

export function FavoritesSortedGrid({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode[];
}) {
  const { isFavorite, hydrated } = useFavorites();
  const isMobile = useIsMobile();
  const t = useTranslations("shop");
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const ordered = useMemo(() => {
    const pairs = ids.map((id, index) => ({ id, node: children[index] }));
    if (!hydrated) return pairs;
    // Array.prototype.sort is stable, so favorites keep their relative order.
    return [...pairs].sort(
      (a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)),
    );
  }, [ids, children, hydrated, isFavorite]);

  // A new filter/sort/search hands us a different id list, or the viewport
  // crossed the mobile breakpoint — start capped again at the right page
  // size instead of keeping whatever page the previous list/size was on.
  // Adjusted during render (React's documented pattern for this) rather
  // than in a useEffect, so it takes effect before the over-long list ever
  // paints.
  const resetKey = `${ids.join("|")}|${pageSize}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setVisibleCount(pageSize);
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
          onClick={() => setVisibleCount((count) => count + pageSize)}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
