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

function reasonLabelKey(reason: string): keyof typeof MESSAGE_BUNDLES["fr"]["orders"] | null {
  switch (reason) {
    case "invalid_payment":
      return "reasonInvalidPayment";
    case "out_of_stock":
      return "reasonOutOfStock";
    case "undeliverable_location":
      return "reasonUndeliverableLocation";
    default:
      return null;
  }
}

// Preset reasons are translated into the customer's locale; free-typed
// ("other") reasons stay in whatever language the admin wrote them in —
// there's no translation engine here for arbitrary admin text.
export function resolveReasonLabel(reason: string, locale: string | null): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(locale)];
  const key = reasonLabelKey(reason);
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

export function buildClientWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
