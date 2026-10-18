import type { ComponentProps } from "react";
import { IntlProvider } from "use-intl";
import { TIME_ZONE } from "@/i18n/routing";

// Remplace next-intl côté composants : next-intl est lui-même construit sur
// use-intl, dont les hooks ont exactement la même API.
export {
  useFormatter,
  useLocale,
  useMessages,
  useNow,
  useTimeZone,
  useTranslations,
} from "use-intl";

// La signature de next-intl : hasLocale(locales, candidat).
export function hasLocale<T extends string>(
  locales: readonly T[],
  candidate: unknown,
): candidate is T {
  return (locales as readonly unknown[]).includes(candidate);
}

// Le fournisseur des messages de la langue courante (src/routes/$locale/route.tsx),
// avec le même fuseau horaire que le rendu serveur.
export function NextIntlClientProvider(props: ComponentProps<typeof IntlProvider>) {
  return <IntlProvider timeZone={TIME_ZONE} {...props} />;
}
