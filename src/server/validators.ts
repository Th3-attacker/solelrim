// Validateurs d'entrée des server functions des routes : les paramètres
// d'URL et de recherche arrivent du navigateur, on n'en garde que des chaînes.

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

// Champs obligatoires (paramètres de chemin : $storeType, $orderId…).
export function stringFields<K extends string>(...keys: K[]) {
  return (input: unknown): Record<K, string> => {
    const record = asRecord(input);
    return Object.fromEntries(
      keys.map((key) => [key, typeof record[key] === "string" ? record[key] : ""]),
    ) as Record<K, string>;
  };
}

// Champs facultatifs (paramètres de recherche ?page=, ?q=…), comme les
// searchParams de Next.js : une valeur répétée garde la première.
export function optionalStringFields<K extends string>(...keys: K[]) {
  return (input: unknown): Partial<Record<K, string>> => {
    const record = asRecord(input);
    const fields: Partial<Record<K, string>> = {};
    for (const key of keys) {
      const value = Array.isArray(record[key]) ? record[key][0] : record[key];
      if (typeof value === "string") fields[key] = value;
    }
    return fields;
  };
}

// Paramètres de chemin obligatoires + paramètres de recherche facultatifs,
// l'entrée habituelle d'un loader de page.
export function routeFields<R extends string, O extends string>(
  required: readonly R[],
  optional: readonly O[],
) {
  const requiredFields = stringFields(...required);
  const optionalFields = optionalStringFields(...optional);
  return (input: unknown) => ({ ...optionalFields(input), ...requiredFields(input) });
}

// L'entrée générique d'un loader de page du tableau de bord : ses paramètres
// de chemin et de recherche, tous des chaînes (ex-props params / searchParams
// des pages Next.js).
export function pageInput(input: unknown): {
  params: Record<string, string>;
  search: Record<string, string | undefined>;
} {
  const record = asRecord(input);
  const strings = (value: unknown) =>
    Object.fromEntries(
      Object.entries(asRecord(value)).flatMap(([key, item]) => {
        const first = Array.isArray(item) ? item[0] : item;
        return typeof first === "string" ? [[key, first]] : [];
      }),
    );
  return { params: strings(record.params), search: strings(record.search) };
}
