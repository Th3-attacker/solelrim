"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-1",
        // On mobile the inline-expanding input has nowhere to grow — it was
        // colliding with the site name and forcing the header to overflow
        // horizontally. Taking over the full header row avoids that instead
        // of squeezing everything into the same line.
        isMobile && "absolute inset-0 z-20 bg-background px-4",
      )}
    >
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className={cn("h-8", isMobile ? "flex-1" : "w-32 sm:w-48")}
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
