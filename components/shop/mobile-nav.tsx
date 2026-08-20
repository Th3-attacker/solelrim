"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { List, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type SearchCategory = { id: string; name: string };

export function MobileNav({
  categories,
  productType,
  basePath,
}: {
  categories: SearchCategory[];
  productType: string;
  basePath: string;
}) {
  const t = useTranslations("shop");
  const tNav = useTranslations("nav");
  const tLanguage = useTranslations("language");
  const [open, setOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLDivElement>(null);

  // The real SearchTrigger lives outside the nav Sheet on purpose: Radix
  // unmounts a Sheet's content (and everything nested inside it) once its
  // close animation finishes, which would tear down SearchTrigger's own
  // state and close its dialog right along with the nav sheet. Keeping it
  // as a sibling means it survives the nav sheet closing, so this row just
  // closes the nav and forwards the tap to the real (hidden) trigger.
  function handleSearchRowClick() {
    setOpen(false);
    searchTriggerRef.current?.querySelector("button")?.click();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("menu")}
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <List className="size-4" />
      </Button>
      <div ref={searchTriggerRef} className="hidden">
        <SearchTrigger categories={categories} productType={productType} basePath={basePath} />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showHandle className="rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4 py-4">
            <button
              type="button"
              onClick={handleSearchRowClick}
              className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span>{t("search")}</span>
              <MagnifyingGlass className="size-4 text-muted-foreground" />
            </button>
            <div className="flex items-center justify-between rounded-lg ps-4 pe-1.5 py-3 text-sm font-medium transition-colors hover:bg-muted">
              <span>{tLanguage("label")}</span>
              <LanguageSwitcher onSelect={() => setOpen(false)} />
            </div>
            <div className="my-1 border-t" />
            <Link
              href={basePath || "/"}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {tNav("home")}
            </Link>
            <Link
              href={`${basePath}/products`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {tNav("products")}
            </Link>
            <Link
              href={`${basePath}/about`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("aboutLink")}
            </Link>
            <Link
              href={`${basePath}/contact`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("contactLink")}
            </Link>
            <Link
              href={`${basePath}/track-order`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("trackOrderLink")}
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
