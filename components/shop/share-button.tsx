"use client";

import { Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const t = useTranslations("shop");

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  return (
    <button
      type="button"
      aria-label={t("share")}
      onClick={handleShare}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-transform hover:scale-110",
        className,
      )}
    >
      <Share className="size-4" />
    </button>
  );
}
