"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

export function MobileNav() {
  const t = useTranslations("shop");
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
