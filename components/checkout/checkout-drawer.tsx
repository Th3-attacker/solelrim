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
import { useCheckoutDrawer } from "@/components/checkout/checkout-drawer-provider";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

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

  const side = isMobile ? "bottom" : getDirection(locale) === "rtl" ? "left" : "right";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeCheckout()}>
      <SheetContent
        side={side}
        className={
          side === "bottom"
            ? "flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl"
            : "flex flex-col gap-0"
        }
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
