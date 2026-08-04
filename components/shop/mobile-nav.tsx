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
import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

type SearchCategory = { id: string; name: string };
type SearchProduct = { id: string; slug: string; name: string };

export function MobileNav({
  categories,
  products,
}: {
  categories: SearchCategory[];
  products: SearchProduct[];
}) {
  const t = useTranslations("shop");
  const tLanguage = useTranslations("language");
  const { storeType } = useParams<{ storeType: string }>();
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
        <Menu className="size-4" />
      </Button>
      <div ref={searchTriggerRef} className="hidden">
        <SearchTrigger categories={categories} products={products} />
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
              <Search className="size-4 text-muted-foreground" />
            </button>
            <div className="flex items-center justify-between rounded-lg ps-4 pe-1.5 py-3 text-sm font-medium transition-colors hover:bg-muted">
              <span>{tLanguage("label")}</span>
              <LanguageSwitcher />
            </div>
            <div className="my-1 border-t" />
            <Link
              href={`/${storeType}/about`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("aboutLink")}
            </Link>
            <Link
              href={`/${storeType}/contact`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("contactLink")}
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
