import "server-only";
import type { useTranslations } from "use-intl";
import { createFormatter, createTranslator } from "use-intl/core";
import { routing, TIME_ZONE, type Locale } from "@/i18n/routing";
import { loadMessages } from "@/i18n/messages";
import { getAppRequestContext } from "@/src/server/request-context";

// Remplace next-intl/server : les traductions des server functions, loaders,
// routes API et server actions, dans la langue de la requête en cours
// (établie par src/middleware/request.ts).

type LocaleOption = { locale?: string };

function resolveLocale(locale?: string): Locale {
  const requested = locale ?? getAppRequestContext()?.locale;
  return (routing.locales as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : routing.defaultLocale;
}

export async function getLocale(): Promise<Locale> {
  return resolveLocale();
}

export async function getMessages(options?: LocaleOption) {
  return loadMessages(resolveLocale(options?.locale));
}

// Même typage que useTranslations côté composants (messages non typés).
type Translator = ReturnType<typeof useTranslations>;

export async function getTranslations(
  namespaceOrOptions?: string | (LocaleOption & { namespace?: string }),
): Promise<Translator> {
  const options =
    typeof namespaceOrOptions === "string" ? { namespace: namespaceOrOptions } : namespaceOrOptions;
  const locale = resolveLocale(options?.locale);
  return createTranslator({
    locale,
    messages: await loadMessages(locale),
    namespace: options?.namespace as never,
    timeZone: TIME_ZONE,
  }) as unknown as Translator;
}

export async function getFormatter(options?: LocaleOption) {
  return createFormatter({ locale: resolveLocale(options?.locale), timeZone: TIME_ZONE });
}

// La langue vient déjà de l'URL (middleware) : plus rien à déclarer.
export function setRequestLocale(_locale: string): void {}
