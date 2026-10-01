import type { JsonValue } from "@/lib/generated/prisma/internal/prismaNamespace";

export type AuditChangeRow = {
  field: string;
  // undefined = the field isn't on that side (a creation has no "before").
  before?: JsonValue;
  after?: JsonValue;
};

function asObject(value: JsonValue | null): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : {};
}

// One row per field present on either side, in the order the writer listed
// them (before's fields first, then any only in after).
export function auditChangeRows(
  oldValue: JsonValue | null,
  newValue: JsonValue | null,
): AuditChangeRow[] {
  const before = asObject(oldValue);
  const after = asObject(newValue);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields.map((field) => ({
    field,
    ...(field in before && { before: before[field] }),
    ...(field in after && { after: after[field] }),
  }));
}
