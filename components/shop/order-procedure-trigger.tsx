"use client";

import { useState } from "react";
import { Question } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { OrderProcedure } from "@/components/shop/order-procedure";

export function OrderProcedureTrigger() {
  const t = useTranslations("orderProcedure");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-foreground"
      >
        <Question className="size-4" />
        {t("trigger")}
      </button>
      <OrderProcedure open={open} onOpenChange={setOpen} />
    </>
  );
}
