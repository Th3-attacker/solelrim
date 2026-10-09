// Turns the SOLAL contact (free text typed by the superadmin) into links
// that open WhatsApp or the mail app with the message already written.

// wa.me wants the full international number, digits only. A bare 8-digit
// local number is a Mauritanian one (the same assumption as the customer
// WhatsApp links in client-messages.ts).
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 8) return null;
  const international = digits.length === 8 ? `222${digits}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(
  email: string | null | undefined,
  subject: string,
  body: string,
): string | null {
  const address = (email ?? "").trim();
  if (!address.includes("@")) return null;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
