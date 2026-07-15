"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title: string }) {
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
    <Button type="button" variant="outline" size="sm" onClick={handleShare}>
      <Share2 className="size-4" />
      {t("share")}
    </Button>
  );
}
