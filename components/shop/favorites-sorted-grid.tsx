"use client";

import { useMemo } from "react";
import { useFavorites } from "@/components/shop/favorites-provider";

export function FavoritesSortedGrid({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode[];
}) {
  const { isFavorite, hydrated } = useFavorites();

  const ordered = useMemo(() => {
    const pairs = ids.map((id, index) => ({ id, node: children[index] }));
    if (!hydrated) return pairs;
    // Array.prototype.sort is stable, so favorites keep their relative order.
    return [...pairs].sort(
      (a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)),
    );
  }, [ids, children, hydrated, isFavorite]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
      {ordered.map((item) => (
        <div key={item.id}>{item.node}</div>
      ))}
    </div>
  );
}
