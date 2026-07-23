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
import { useVisualViewport, visualViewportStyle } from "@/hooks/use-visual-viewport";
import { useCheckoutDrawer } from "@/components/checkout/checkout-drawer-provider";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { cn } from "@/lib/utils";

type Settings = {
  bankilyNumber: string | null;
  masrivyNumber: string | null;
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
        style={
          side === "bottom" && keyboardOpen
            ? visualViewportStyle(viewportRect)
            : undefined
        }
        className={cn(
          "flex flex-col gap-0",
          side === "bottom" && "rounded-t-2xl",
          side === "bottom" && !keyboardOpen && "max-h-[90dvh]",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <CheckoutFlow settings={settings} open={open} onClose={closeCheckout} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
