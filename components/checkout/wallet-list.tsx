"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Wallet } from "@phosphor-icons/react/dist/ssr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";

// The boutique's mobile money accounts on the payment step: tap the number to
// copy it, tap the logo for how to pay with that wallet.
export function WalletList({
  wallets,
}: {
  wallets: { provider: string; number: string; logoUrl: string | null }[];
}) {
  const t = useTranslations("checkout");
  const [copiedWalletIndex, setCopiedWalletIndex] = useState<number | null>(null);

  async function handleCopyWalletNumber(index: number, provider: string, number: string) {
    await navigator.clipboard.writeText(number);
    setCopiedWalletIndex(index);
    toast.success(t("walletNumberCopied", { provider }));
    setTimeout(() => {
      setCopiedWalletIndex((current) => (current === index ? null : current));
    }, 2000);
  }

  return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {wallets.map((wallet, index) => (
            <Popover key={index}>
              <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center transition-colors hover:bg-muted/50">
                <PopoverTrigger asChild>
                  <button type="button" className="flex flex-col items-center gap-1.5">
                    {wallet.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={wallet.logoUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card">
                        <Wallet className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {wallet.provider}
                    </span>
                  </button>
                </PopoverTrigger>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyWalletNumber(index, wallet.provider, wallet.number)
                  }
                  aria-label={t("copyWalletNumber", { provider: wallet.provider })}
                  className="flex min-w-0 items-center gap-1 text-sm font-semibold"
                >
                  <span dir="ltr" className="truncate">
                    {wallet.number}
                  </span>
                  {copiedWalletIndex === index ? (
                    <Check className="size-3.5 shrink-0 text-success" />
                  ) : (
                    <Copy className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </div>
              <PopoverContent className="w-64 text-center text-sm">
                {t("walletNumberHint", { provider: wallet.provider })}
              </PopoverContent>
            </Popover>
          ))}
        </div>
  );
}
