"use client";

import {
  CreditCard,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export type OrderProcedureVariant = "auto" | "modal" | "sheet";

const STEP_ICONS = [ShoppingBag, CreditCard, MessageCircle, PackageCheck] as const;

function OrderProcedureSteps() {
  const t = useTranslations("orderProcedure");

  return (
    <ol className="flex flex-col gap-5">
      {STEP_ICONS.map((Icon, index) => {
        const step = index + 1;
        return (
          <li key={step} className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{t(`step${step}Title`)}</p>
              <p className="text-sm text-muted-foreground">
                {t(`step${step}Description`)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderProcedure({
  open,
  onOpenChange,
  title,
  variant = "auto",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  variant?: OrderProcedureVariant;
}) {
  const t = useTranslations("orderProcedure");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const asSheet = variant === "sheet" || (variant === "auto" && isMobile);

  const heading = title ?? t("title");

  if (asSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{heading}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">
            <OrderProcedureSteps />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("close")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <OrderProcedureSteps />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
