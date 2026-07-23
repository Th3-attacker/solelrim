// Pre-filled text is deliberately hardcoded French, not run through
// next-intl: it is addressed to the store's French-speaking admin
// regardless of the customer's browsing locale — same rationale as
// lib/shop/whatsapp.ts.
export function buildWhatsAppLink(adminWhatsappNumber: string, text?: string): string {
  const phone = adminWhatsappNumber.replace(/\D/g, "");
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`;
}

export function buildOrderQuestionWhatsAppLink(adminWhatsappNumber: string): string {
  return buildWhatsAppLink(adminWhatsappNumber, "Question sur une commande");
}
