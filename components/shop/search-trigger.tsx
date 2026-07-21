"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export function SearchTrigger() {
  const t = useTranslations("shop");
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}#catalog`);
    setOpen(false);
    setQuery("");
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={t("search")}>
            <Search className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t("search")}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-4">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1"
            />
            <Button type="submit" size="icon" aria-label={t("search")}>
              <Search className="size-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("search")}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-8 w-32 sm:w-48"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("closeSearch")}
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}
