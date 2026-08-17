import { formatPrice } from "@/lib/format/currency";

// The message body is deliberately hardcoded French, not run through next-intl:
// it is addressed to the store's French-speaking admin regardless of the
// customer's browsing locale. Do not localize this.
export function buildOrderWhatsAppLink(params: {
  adminWhatsappNumber: string;
  reference: string;
  items: {
    productName: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
  }[];
  total: number;
  customerName: string;
  customerPhone: string;
  customerCity: string;
}): string {
  const lines = [
    `Nouvelle commande ${params.reference}`,
    "",
    ...params.items.map(
      (i) =>
        `- ${i.productName} (${i.size}, ${i.color}) x${i.quantity} — ${formatPrice(i.unitPrice * i.quantity, "MRU")}`,
    ),
    "",
    `Total: ${formatPrice(params.total, "MRU")}`,
    "",
    `Client: ${params.customerName}`,
    // +222 prefix so WhatsApp's own auto-detection of phone-shaped text in
    // the message body resolves to Mauritania instead of guessing another
    // country from the leading digits — same root cause as
    // buildClientWhatsAppLink in client-messages.ts.
    `Téléphone: +222 ${params.customerPhone}`,
    `Ville: ${params.customerCity}`,
    "",
    "Une capture d'écran du paiement a été envoyée via le site.",
  ];
  const text = encodeURIComponent(lines.join("\n"));
  const phone = params.adminWhatsappNumber.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${text}`;
}
