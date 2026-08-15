export type CsvColumn = { key: string; label: string };

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const UTF8_BOM = "﻿";

// BOM-prefixed so Excel (the realistic target here) detects the encoding
// correctly instead of mangling accented French/Arabic text.
export function toCsv(
  columns: CsvColumn[],
  rows: Record<string, string | number>[],
): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key] ?? "")).join(","),
  );
  return UTF8_BOM + [headerLine, ...lines].join("\r\n");
}
