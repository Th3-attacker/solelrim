import { Badge } from "@/components/ui/badge";
import { formatPriceNumber } from "@/lib/format/currency";
import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";
import { cn } from "@/lib/utils";

// Currency as its own pill, not appended text: keeps the number the visual
// focus and lets the currency mark pick up the theme (border/muted tone)
// instead of competing with it for weight.
export function Price({
  value,
  currency,
  size = "default",
  strikethrough = false,
  className,
}: {
  value: number | Decimal;
  currency?: string;
  size?: "default" | "lg";
  strikethrough?: boolean;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      className={cn("inline-flex items-baseline gap-1.5", className)}
    >
      <span
        className={cn(
          strikethrough
            ? "font-normal text-muted-foreground line-through"
            : "font-semibold text-foreground",
          size === "lg" ? "text-xl" : "text-sm",
        )}
      >
        {formatPriceNumber(value)}
      </span>
      {currency && (
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 self-center border-foreground/15 font-normal text-muted-foreground",
            size === "lg" ? "text-[11px]" : "text-[10px]",
          )}
        >
          {currency}
        </Badge>
      )}
    </span>
  );
}
