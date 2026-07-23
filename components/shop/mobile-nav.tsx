"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchTrigger } from "@/components/shop/search-trigger";
import { Link } from "@/i18n/navigation";

type SearchCategory = { id: string; name: string };
type SearchProduct = { id: string; name: string };

export function MobileNav({
  categories,
  products,
}: {
  categories: SearchCategory[];
  products: SearchProduct[];
}) {
  const t = useTranslations("shop");
  const tLanguage = useTranslations("language");
  const [open, setOpen] = useState(false);

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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showHandle className="rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-2 pb-4">
            <div
              className="flex items-center justify-between rounded-lg px-4 py-1 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span>{t("search")}</span>
              <SearchTrigger categories={categories} products={products} />
            </div>
            <div className="flex items-center justify-between rounded-lg px-4 py-1 text-sm font-medium transition-colors hover:bg-muted">
              <span>{tLanguage("label")}</span>
              <LanguageSwitcher />
            </div>
            <div className="my-1 border-t" />
            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("aboutLink")}
            </Link>
            <Link
              href="/contact"
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
