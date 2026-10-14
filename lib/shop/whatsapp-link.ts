// A wa.me link opening WhatsApp on the sender's own device with the message
// ready; they still press send. Pure string building: screens use it too.
export function buildClientWhatsAppLink(phone: string, message: string): string {
  // customerPhone is stored as a bare 8-digit local number (see
  // checkoutCustomerSchema / /^[234]\d{7}$/), with no country code — wa.me
  // needs the full international number, so without this prefix WhatsApp
  // guesses a country from the leading digits (e.g. "32..." reads as
  // Belgium +32) instead of Mauritania.
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/222${digits}?text=${encodeURIComponent(message)}`;
}
