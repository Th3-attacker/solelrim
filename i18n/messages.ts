import type { Locale } from "@/i18n/routing";
import type frMessages from "@/messages/fr.json";

export type Messages = typeof frMessages;

// Un fichier de messages par langue, chargé à la demande : le navigateur ne
// télécharge que celui de la langue affichée (ex-getRequestConfig de
// i18n/request.ts).
const bundles = import.meta.glob<Messages>("../messages/*.json", { import: "default" });

export function loadMessages(locale: Locale): Promise<Messages> {
  return bundles[`../messages/${locale}.json`]();
}
