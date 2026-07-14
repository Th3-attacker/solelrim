"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintLabelButton() {
  const t = useTranslations("orders");

  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" />
      {t("printLabel")}
    </Button>
  );
}
