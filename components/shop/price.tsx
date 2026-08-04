import { formatPriceNumber } from "@/lib/format/currency";
import type { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace";
import { cn } from "@/lib/utils";

// The current/sale price is the visual anchor: large and bold, in the
// boutique's own accent color when it's a deal (emphasize) so the eye lands
// on it first. Currency sits inline as quiet muted text right after the
// number — not a bordered pill, which read as visual clutter competing with
// the price itself. The struck-through original price (when present) is a
// separate <Price strikethrough /> instance placed after this one.
export function Price({
  value,
  currency,
  size = "default",
  strikethrough = false,
  emphasize = false,
  className,
}: {
  value: number | Decimal;
  currency?: string;
  size?: "default" | "lg";
  strikethrough?: boolean;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <span dir="ltr" className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          strikethrough
            ? "font-normal text-muted-foreground line-through"
            : emphasize
              ? "font-bold text-primary"
              : "font-semibold text-foreground",
          size === "lg" ? "text-2xl" : "text-base",
        )}
      >
        {formatPriceNumber(value)}
      </span>
      {currency && (
        <span
          className={cn(
            "font-medium text-muted-foreground",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {currency}
        </span>
      )}
    </span>
  );
}
