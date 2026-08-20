import { formatPrice } from "@/lib/format/currency";

export type ShareableCartLine = {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
};

// Plain text, not a WhatsApp-specific link like buildOrderWhatsAppLink —
// this goes through the generic Web Share API (or clipboard), so the
// customer picks who it goes to, unlike the order confirmation message
// which is always addressed to this boutique's own admin number.
export function buildCartShareText(
  items: ShareableCartLine[],
  subtotal: number,
  currency: string,
  totalLabel: string,
): string {
  const lines = [
    ...items.map(
      (i) =>
        `- ${i.productName} (${i.size}, ${i.color}) x${i.quantity} — ${formatPrice(i.unitPrice * i.quantity, currency)}`,
    ),
    "",
    `${totalLabel} ${formatPrice(subtotal, currency)}`,
  ];
  return lines.join("\n");
}
