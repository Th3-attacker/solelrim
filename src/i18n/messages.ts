import type { AbstractIntlMessages } from "use-intl";
import type { Locale } from "./config";

// The catalogues hold a few arrays too (help steps, read with t.raw), which
// use-intl's generic message type doesn't describe. Typed keys come with the
// cutover: declaring them now would also retype the Next.js build's
// next-intl, which shares use-intl's types.
const asMessages = (module: { default: object }) => module.default as AbstractIntlMessages;

// One chunk per language, fetched once and cached by the browser like any
// other hashed asset, instead of ~80 KB inlined into every HTML response.
const chunks: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  fr: () => import("../../messages/fr.json").then(asMessages),
  en: () => import("../../messages/en.json").then(asMessages),
  ar: () => import("../../messages/ar.json").then(asMessages),
};

const loaded = new Map<Locale, Promise<AbstractIntlMessages>>();

// The same promise for the same language, so React's use() resolves it
// synchronously after the first render instead of suspending each time.
export function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  let messages = loaded.get(locale);
  if (!messages) {
    // A chunk that failed (offline, new deploy) is asked for again next time.
    messages = chunks[locale]().catch((error: unknown) => {
      loaded.delete(locale);
      throw error;
    });
    loaded.set(locale, messages);
  }
  return messages;
}
