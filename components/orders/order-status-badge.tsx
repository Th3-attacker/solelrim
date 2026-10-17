import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// One look per status, from the theme's tokens (components/ui/badge.tsx).
const STATUS_BADGE: Record<
  OrderStatus,
  {
    variant: "warning" | "success" | "info" | "destructive" | "outline" | "default";
    label: string;
    className?: string;
  }
> = {
  PENDING: { variant: "warning", label: "pending" },
  CONFIRMED: { variant: "success", label: "confirmed" },
  SHIPPING: { variant: "info", label: "shipping" },
  DELIVERED: { variant: "default", label: "delivered", className: "bg-success text-white" },
  REJECTED: { variant: "destructive", label: "rejected" },
  CANCELLED: { variant: "outline", label: "cancelled", className: "text-muted-foreground" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orders");
  const { variant, label, className } = STATUS_BADGE[status];
  return (
    <Badge variant={variant} className={className}>
      {t(label)}
    </Badge>
  );
}
