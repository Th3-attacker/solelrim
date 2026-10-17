import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { formatPrice } from "@/lib/format/currency";
import { DEFAULT_LOCALE, isAppLocale } from "@/lib/i18n-locales";
import { REASON_LABEL_KEY } from "@/lib/shop/order-reasons";

// The presets live apart (no message bundles): screens import them.
export { REASON_LABEL_KEY, REJECT_REASON_PRESETS } from "@/lib/shop/order-reasons";

// Messages sent to the *customer* (order confirmed/rejected), unlike
// buildOrderWhatsAppLink in whatsapp.ts which is addressed to the
// French-speaking admin. These must follow whatever locale the customer
// actually checked out in (Order.locale), not the admin's own locale —
// so this reads the message bundles directly instead of next-intl's
// request-scoped getTranslations/useTranslations.
const MESSAGE_BUNDLES = { fr: frMessages, en: enMessages, ar: arMessages } as const;

type SupportedLocale = keyof typeof MESSAGE_BUNDLES;

function resolveLocale(locale: string | null | undefined): SupportedLocale {
  return isAppLocale(locale) ? locale : DEFAULT_LOCALE;
}

// Preset reasons are translated into the customer's locale; free-typed
// ("other") reasons stay in whatever language the admin wrote them in —
// there's no translation engine here for arbitrary admin text.
function resolveReasonLabel(reason: string, locale: string | null): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(locale)];
  const key = REASON_LABEL_KEY[reason];
  return key ? bundle.orders[key] : reason;
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, value),
    template,
  );
}

export function buildClientConfirmationMessage(params: {
  locale: string | null;
  customerName: string;
  reference: string;
  total: number;
}): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(params.locale)];
  return fillTemplate(bundle.orders.clientConfirmationMessage, {
    name: params.customerName,
    reference: params.reference,
    total: formatPrice(params.total, bundle.common.currency),
  });
}

export function buildClientRejectionMessage(params: {
  locale: string | null;
  customerName: string;
  reference: string;
  reason: string;
}): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(params.locale)];
  return fillTemplate(bundle.orders.clientRejectionMessage, {
    name: params.customerName,
    reference: params.reference,
    reason: resolveReasonLabel(params.reason, params.locale),
  });
}

export function buildClientShippedMessage(params: {
  locale: string | null;
  customerName: string;
  reference: string;
}): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(params.locale)];
  return fillTemplate(bundle.orders.clientShippedMessage, {
    name: params.customerName,
    reference: params.reference,
  });
}

export function buildClientDeliveredMessage(params: {
  locale: string | null;
  customerName: string;
  reference: string;
}): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(params.locale)];
  return fillTemplate(bundle.orders.clientDeliveredMessage, {
    name: params.customerName,
    reference: params.reference,
  });
}

export type OrderPushEvent = "confirmed" | "rejected" | "shipped" | "delivered" | "cancelled";

// The short title + body of a push notification about an order, in the
// language the customer ordered in (the same bundles as the WhatsApp texts).
export function buildOrderPushMessage(params: {
  event: OrderPushEvent;
  locale: string | null;
  reference: string;
}): { title: string; body: string } {
  const orders = MESSAGE_BUNDLES[resolveLocale(params.locale)].orders;
  const body = {
    confirmed: orders.pushConfirmed,
    rejected: orders.pushRejected,
    shipped: orders.pushShipped,
    delivered: orders.pushDelivered,
    cancelled: orders.pushCancelled,
  }[params.event];
  return { title: fillTemplate(orders.pushTitle, { reference: params.reference }), body };
}

export function buildClientWhatsAppLink(phone: string, message: string): string {
  // customerPhone is stored as a bare 8-digit local number (see
  // checkoutCustomerSchema / /^[234]\d{7}$/), with no country code — wa.me
  // needs the full international number, so without this prefix WhatsApp
  // guesses a country from the leading digits (e.g. "32..." reads as
  // Belgium +32) instead of Mauritania.
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/222${digits}?text=${encodeURIComponent(message)}`;
}
