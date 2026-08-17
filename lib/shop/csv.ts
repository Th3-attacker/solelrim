export type CsvColumn = { key: string; label: string };

// A cell starting with one of these is interpreted as a live formula by
// Excel/Sheets/LibreOffice on open — customerName (Orders export) is public,
// unauthenticated checkout input, so this isn't just theoretical.
const RISKY_LEADING_CHAR = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string | number): string {
  let str = String(value);
  if (RISKY_LEADING_CHAR.test(str)) {
    str = `'${str}`; // leading quote forces spreadsheet apps to treat it as text
  }
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
