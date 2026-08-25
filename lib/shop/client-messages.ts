import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { formatPrice } from "@/lib/format/currency";
import { routing } from "@/i18n/routing";

// Messages sent to the *customer* (order confirmed/rejected), unlike
// buildOrderWhatsAppLink in whatsapp.ts which is addressed to the
// French-speaking admin. These must follow whatever locale the customer
// actually checked out in (Order.locale), not the admin's own locale —
// so this reads the message bundles directly instead of next-intl's
// request-scoped getTranslations/useTranslations.
const MESSAGE_BUNDLES = { fr: frMessages, en: enMessages, ar: arMessages } as const;

type SupportedLocale = keyof typeof MESSAGE_BUNDLES;

export const REJECT_REASON_PRESETS = [
  "invalid_payment",
  "out_of_stock",
  "undeliverable_location",
] as const;

export type RejectReasonPreset = (typeof REJECT_REASON_PRESETS)[number];

function resolveLocale(locale: string | null | undefined): SupportedLocale {
  const locales: readonly string[] = routing.locales;
  return locale && locales.includes(locale)
    ? (locale as SupportedLocale)
    : (routing.defaultLocale as SupportedLocale);
}

// Maps each reject-reason preset to its translation key under the "orders"
// namespace — shared by the admin reject dialog (order-actions.tsx), the
// order detail page (which redisplays a stored reason), and
// resolveReasonLabel below. A free-typed ("other") reason has no entry here
// and is shown/sent as whatever text the admin wrote.
export const REASON_LABEL_KEY: Record<string, keyof typeof MESSAGE_BUNDLES["fr"]["orders"]> = {
  invalid_payment: "reasonInvalidPayment",
  out_of_stock: "reasonOutOfStock",
  undeliverable_location: "reasonUndeliverableLocation",
};

// Preset reasons are translated into the customer's locale; free-typed
// ("other") reasons stay in whatever language the admin wrote them in —
// there's no translation engine here for arbitrary admin text.
export function resolveReasonLabel(reason: string, locale: string | null): string {
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

// Sent from the order detail page once a DELIVERED order's admin wants
// feedback — the client replies straight into the same WhatsApp thread,
// and the admin pastes that reply into Testimonials themselves (no public
// review form exists, see the "témoignages" discussion this followed up).
export function buildClientReviewRequestMessage(params: {
  locale: string | null;
  customerName: string;
  reference: string;
}): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(params.locale)];
  return fillTemplate(bundle.orders.clientReviewRequestMessage, {
    name: params.customerName,
    reference: params.reference,
  });
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
