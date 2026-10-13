"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Package } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// The checkout's last screen: the order's reference to keep, and the ways to
// follow it up.
export function CheckoutSuccess({
  reference,
  basePath,
  onSendWhatsApp,
}: {
  reference: string;
  basePath: string;
  onSendWhatsApp: () => void;
}) {
  const t = useTranslations("checkout");
  const tTrackOrder = useTranslations("trackOrder");
  const [referenceCopied, setReferenceCopied] = useState(false);

  async function handleCopyReference() {
    await navigator.clipboard.writeText(reference);
    setReferenceCopied(true);
    toast.success(t("referenceCopied"));
    setTimeout(() => setReferenceCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center sm:my-6 sm:p-8">
      <h1 className="text-heading-xs">{t("successTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("successMessage")}</p>
      <div className="flex w-full flex-col items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-md border bg-card py-1.5 ps-3 pe-1.5">
          <span className="font-mono text-sm">{reference}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyReference}
            aria-label={t("copyReference")}
          >
            {referenceCopied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("keepReferenceHint")}</p>
      </div>
      <Button onClick={onSendWhatsApp} className="w-full">
        {t("sendWhatsApp")}
      </Button>
      <Button variant="outline" className="w-full" asChild>
        <Link href={`${basePath}/track-order`}>
          <Package className="size-4" />
          {tTrackOrder("title")}
        </Link>
      </Button>
      <Button variant="ghost" className="w-full" asChild>
        <Link href={basePath || "/"}>{t("backToCatalog")}</Link>
      </Button>
    </div>
  );
}
