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
        `- ${i.productName} (${i.size}, ${i.color}) x${i.quantity} — ${(i.unitPrice * i.quantity).toFixed(2)} MRU`,
    ),
    "",
    `Total: ${params.total.toFixed(2)} MRU`,
    "",
    `Client: ${params.customerName}`,
    `Téléphone: ${params.customerPhone}`,
    `Ville: ${params.customerCity}`,
    "",
    "Une capture d'écran du paiement a été envoyée via le site.",
  ];
  const text = encodeURIComponent(lines.join("\n"));
  const phone = params.adminWhatsappNumber.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${text}`;
}
