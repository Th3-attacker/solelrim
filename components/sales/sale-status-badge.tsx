"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export type SaleStatus = "COMPLETED" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";

const VARIANT: Record<SaleStatus, "secondary" | "destructive" | "outline"> = {
  COMPLETED: "secondary",
  PARTIALLY_REFUNDED: "outline",
  REFUNDED: "outline",
  CANCELLED: "destructive",
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const t = useTranslations("sales");
  return <Badge variant={VARIANT[status]}>{t(`saleStatus.${status}`)}</Badge>;
}
