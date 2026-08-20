"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { matchesSearch } from "@/lib/shop/search-text";
import { searchProductSuggestions } from "@/lib/actions/search";
import { formatPrice } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

type SearchCategory = { id: string; name: string };

type SearchItem =
  | { type: "category"; id: string; href: string; label: string }
  | {
      type: "product";
      id: string;
      href: string;
      label: string;
      imageUrl: string | null;
      price: number;
    };

const MAX_CATEGORY_SUGGESTIONS = 3;
const SEARCH_DEBOUNCE_MS = 250;

export function SearchTrigger({
  categories,
  productType,
  basePath,
}: {
  categories: SearchCategory[];
  productType: string;
  basePath: string;
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, focusWithin: keyboardOpen, onFocus, onBlur, reset } =
    useFocusWithin<HTMLDivElement>();
  const viewportRect = useVisualViewport(keyboardOpen);

  const hasQuery = query.trim().length > 0;

  const quickLinkItems = useMemo<SearchItem[]>(
    () =>
      categories.map((category) => ({
        type: "category",
        id: category.id,
        href: `${basePath}/products?category=${category.id}`,
        label: category.name,
      })),
    [categories, basePath],
  );

  // Product matches come from the database (lib/actions/search.ts), not a
  // full in-memory catalog filtered here — the catalog can grow well past
  // what's reasonable to ship to every visitor just to power the search
  // box. Debounced so it isn't a query per keystroke.
  const [matchedProducts, setMatchedProducts] = useState<SearchItem[]>([]);
  const [searchPending, startSearchTransition] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    // Nothing to clear here on purpose — matchedItems below already
    // returns [] whenever the query is empty, so a stale matchedProducts
    // value from a previous query never actually surfaces.
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      startSearchTransition(async () => {
        const results = await searchProductSuggestions(productType, trimmed);
        setMatchedProducts(
          results.map((product) => ({
            type: "product",
            id: product.id,
            href: `${basePath}/products/${product.slug}`,
            label: product.name,
            imageUrl: product.imageUrl,
            price: product.price,
          })),
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, productType, basePath]);

  const matchedItems = useMemo<SearchItem[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const matchedCategories: SearchItem[] = categories
      .filter((category) => matchesSearch(category.name, trimmed))
      .slice(0, MAX_CATEGORY_SUGGESTIONS)
      .map((category) => ({
        type: "category",
        id: category.id,
        href: `${basePath}/products?category=${category.id}`,
        label: category.name,
      }));
    return [...matchedCategories, ...matchedProducts];
  }, [categories, matchedProducts, query, basePath]);

  const items = hasQuery ? matchedItems : quickLinkItems;

  // The active item only makes sense for the list currently on screen —
  // drop it whenever the query (and therefore the list) changes. Adjusted
  // during render rather than in an effect, so it lands in the same
  // commit instead of triggering a follow-up render.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(-1);
  }

  function close() {
    setOpen(false);
    setQuery("");
    reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`${basePath}/products?q=${encodeURIComponent(trimmed)}`);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      router.push(items[activeIndex].href);
      close();
    }
  }

  // Radix would otherwise auto-focus the input the instant the mobile sheet
  // mounts, popping the keyboard while the sheet is still sliding up —
  // the resize-for-keyboard transition then fights the slide-in animation
  // for the same frames. Deferring focus to the slide-in's real
  // `animationend` sequences them instead: sheet settles, then keyboard.
  function focusInputAfterOpenAnimation(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !open) return;
    inputRef.current?.focus();
  }

  const linksList =
    items.length > 0 ? (
      <div className="flex flex-col">
        {items.map((item, index) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={item.href}
            onClick={close}
            onMouseEnter={() => setActiveIndex(index)}
            className={cn(
              "-mx-2 flex items-center gap-3 rounded-md border-b px-2 py-3 text-sm font-semibold last:border-0",
              index === activeIndex ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            {item.type === "product" ? (
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                )}
              </div>
            ) : (
              <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.type === "product" && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {formatPrice(item.price, tCommon("currency"))}
              </span>
            )}
          </Link>
        ))}
      </div>
    ) : (
      <p className="py-3 text-sm text-muted-foreground">
        {hasQuery && searchPending ? tCommon("loading") : tCommon("noResults")}
      </p>
    );

  function renderSearchInput(autoFocus: boolean) {
    return (
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus={autoFocus}
            aria-label={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("searchPlaceholder")}
            className="h-auto rounded-lg bg-muted/40 py-2.5 ps-9 text-base shadow-none"
          />
        </div>
      </form>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("search")}
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass className="size-4" />
      </Button>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        {isMobile ? (
          <SheetContent
            ref={ref}
            onFocus={onFocus}
            onBlur={onBlur}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onAnimationEnd={focusInputAfterOpenAnimation}
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
              {renderSearchInput(false)}
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
                <div className="max-w-md">{renderSearchInput(true)}</div>
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
