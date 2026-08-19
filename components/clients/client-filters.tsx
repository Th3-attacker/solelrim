"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const SYNC_DEBOUNCE_MS = 400;

// Mirrors OrderFilters' debounced-URL-sync pattern (components/orders/order-filters.tsx),
// scaled down to a single search field.
export function ClientFilters() {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [isSyncing, startSyncTransition] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const query = search ? `?q=${encodeURIComponent(search)}` : "";
      startSyncTransition(() => {
        router.replace(`${pathname}${query}`, { scroll: false });
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, pathname, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex min-w-56">
        {isSyncing ? (
          <Spinner className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          aria-label={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="rounded-md ps-9"
        />
      </div>

      {search && (
        <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
          {tCommon("resetFilters")}
        </Button>
      )}
    </div>
  );
}
