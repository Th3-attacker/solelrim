"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintInvoiceButton() {
  const t = useTranslations("common");

  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" />
      {t("print")}
    </Button>
  );
}
