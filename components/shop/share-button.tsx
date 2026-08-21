"use client";

import { Share } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { shareContent, isShareCancelled } from "@/lib/shop/web-share";
import { cn } from "@/lib/utils";

export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const t = useTranslations("shop");
  const tCommon = useTranslations("common");

  async function handleShare() {
    try {
      const result = await shareContent({ title, url: window.location.href });
      if (result === "copied") toast.success(t("linkCopied"));
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error("product share failed", error);
      toast.error(
        error instanceof Error
          ? `${tCommon("error")} (${error.name}: ${error.message})`
          : tCommon("error"),
      );
    }
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
