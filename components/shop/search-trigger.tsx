"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFocusWithin } from "@/hooks/use-focus-within";
import {
  useVisualViewport,
  visualViewportStyle,
  SHEET_PEEK_INSET,
} from "@/hooks/use-visual-viewport";
import { cn } from "@/lib/utils";

type SearchCategory = { id: string; name: string };
type SearchProduct = { id: string; name: string };

const MAX_SUGGESTIONS = 8;

export function SearchTrigger({
  categories,
  products,
}: {
  categories: SearchCategory[];
  products: SearchProduct[];
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { ref, focusWithin: keyboardOpen, onFocus, onBlur, reset } =
    useFocusWithin<HTMLDivElement>();
  const viewportRect = useVisualViewport(keyboardOpen);

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(trimmed))
      .slice(0, MAX_SUGGESTIONS);
  }, [products, query]);

  function close() {
    setOpen(false);
    setQuery("");
    reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}#catalog`);
    close();
  }

  const hasQuery = query.trim().length > 0;

  const linksList = hasQuery ? (
    suggestions.length > 0 ? (
      <div className="flex flex-col">
        {suggestions.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            onClick={close}
            className="flex items-center gap-3 border-b py-3 text-sm font-semibold last:border-0"
          >
            <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            {product.name}
          </Link>
        ))}
      </div>
    ) : (
      <p className="py-3 text-sm text-muted-foreground">{tCommon("noResults")}</p>
    )
  ) : (
    <div className="flex flex-col">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={{ pathname: "/", query: { category: category.id } }}
          onClick={close}
          className="flex items-center gap-3 border-b py-3 text-sm font-semibold last:border-0"
        >
          <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          {category.name}
        </Link>
      ))}
    </div>
  );

  const searchInput = (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
    </form>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("search")}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        {isMobile ? (
          <SheetContent
            ref={ref}
            onFocus={onFocus}
            onBlur={onBlur}
            side="bottom"
            showHandle
            overlayClassName="bg-popover/50 supports-backdrop-filter:backdrop-blur-lg"
            style={
              keyboardOpen
                ? visualViewportStyle(viewportRect, SHEET_PEEK_INSET)
                : undefined
            }
            className={cn(
              "flex flex-col gap-0 rounded-t-2xl transition-all duration-150 ease-out",
              !keyboardOpen && "max-h-[88svh]",
            )}
          >
            <SheetHeader className="pb-2">
              <SheetTitle className="sr-only">{t("search")}</SheetTitle>
              {searchInput}
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <p className="pt-2 pb-1 text-sm text-muted-foreground">
                {hasQuery ? t("suggestedLinks") : t("quickLinks")}
              </p>
              {linksList}
            </div>
            {/* The iOS keyboard is translucent — extend our own background
                below the sheet's visible edge so it blurs through to this
                instead of the page behind. */}
            <div aria-hidden className="absolute inset-x-0 top-full h-screen bg-popover" />
          </SheetContent>
        ) : (
          <SheetContent
            side="top"
            style={{ top: "4rem" }}
            className="gap-0 rounded-b-2xl border-t-0"
          >
            <div className="mx-auto w-full max-w-7xl px-4 desktop:px-8">
              <SheetHeader className="px-0 pb-2">
                <SheetTitle className="sr-only">{t("search")}</SheetTitle>
                <div className="max-w-md">{searchInput}</div>
              </SheetHeader>
              <div className="max-h-[60vh] overflow-y-auto pb-6">
                <p className="pt-2 pb-1 text-sm text-muted-foreground">
                  {hasQuery ? t("suggestedLinks") : t("quickLinks")}
                </p>
                <div className="max-w-md">{linksList}</div>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
