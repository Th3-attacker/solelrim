import { describe, expect, it } from "vitest";
import { createTranslator, type AbstractIntlMessages } from "use-intl";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

// Every key, as "namespace.group.key" paths.
function keys(messages: object, prefix = "", onlyText = false): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? keys(value, `${prefix}${key}.`, onlyText)
      : onlyText && typeof value !== "string"
        ? []
        : [`${prefix}${key}`],
  );
}

describe("message catalogues", () => {
  it("say the same things in French, English and Arabic", () => {
    const reference = keys(fr).sort();
    expect(keys(en).sort()).toEqual(reference);
    expect(keys(ar).sort()).toEqual(reference);
  });

  it.each([
    ["fr", fr],
    ["en", en],
    ["ar", ar],
  ])("are all valid ICU messages in %s (plurals, selects, placeholders)", (locale, messages) => {
    const invalid: string[] = [];
    const t = createTranslator({
      locale,
      messages: messages as unknown as AbstractIntlMessages,
      // Missing values are expected here (none are passed); broken syntax isn't.
      onError: (error) => {
        if (error.code === "INVALID_MESSAGE") invalid.push(error.message);
      },
    });
    // Values make use-intl compile the message (without, it returns it as is).
    const translate = t as (key: string, values: Record<string, unknown>) => string;
    for (const key of keys(messages, "", true)) translate(key, { probe: 0 });
    expect(invalid).toEqual([]);
  });
});
