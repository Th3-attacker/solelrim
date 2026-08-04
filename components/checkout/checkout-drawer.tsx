"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getDirection } from "@/i18n/routing";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFocusWithin } from "@/hooks/use-focus-within";
import {
  useVisualViewport,
  visualViewportStyle,
  SHEET_PEEK_INSET,
} from "@/hooks/use-visual-viewport";
import { useCheckoutDrawer } from "@/components/checkout/checkout-drawer-provider";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { cn } from "@/lib/utils";

type Settings = {
  wallets: { provider: string; number: string; logoUrl: string | null }[];
  adminWhatsappNumber: string | null;
  paymentInstructions: string | null;
};

export function CheckoutDrawer({ settings }: { settings: Settings }) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const { open, closeCheckout } = useCheckoutDrawer();
  const { ref, focusWithin: keyboardOpen, onFocus, onBlur, reset } =
    useFocusWithin<HTMLDivElement>();
  const viewportRect = useVisualViewport(keyboardOpen);

  const side = isMobile ? "bottom" : getDirection(locale) === "rtl" ? "left" : "right";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeCheckout();
          reset();
        }
      }}
    >
      <SheetContent
        ref={ref}
        onFocus={onFocus}
        onBlur={onBlur}
        onOpenAutoFocus={(event) => event.preventDefault()}
        side={side}
        showHandle={side === "bottom"}
        overlayClassName={
          side === "bottom" ? "bg-popover/50 supports-backdrop-filter:backdrop-blur-lg" : undefined
        }
        style={
          side === "bottom" && keyboardOpen
            ? visualViewportStyle(viewportRect, SHEET_PEEK_INSET)
            : undefined
        }
        className={cn(
          "flex flex-col gap-0",
          side === "bottom" && "rounded-t-2xl transition-all duration-150 ease-out",
          side === "bottom" && !keyboardOpen && "max-h-[90svh]",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <CheckoutFlow settings={settings} open={open} onClose={closeCheckout} />
        </div>
        {/* The iOS keyboard is translucent — extend our own background
            below the sheet's visible edge so it blurs through to this
            instead of the page behind. */}
        {side === "bottom" && (
          <div aria-hidden className="absolute inset-x-0 top-full h-screen bg-popover" />
        )}
      </SheetContent>
    </Sheet>
  );
}
