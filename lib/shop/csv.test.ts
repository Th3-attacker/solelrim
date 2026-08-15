import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/shop/csv";

const columns = [
  { key: "name", label: "Name" },
  { key: "note", label: "Note" },
];

describe("toCsv", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = toCsv(columns, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("renders the header row from column labels", () => {
    const csv = toCsv(columns, []);
    expect(csv.slice(1)).toBe("Name,Note");
  });

  it("joins rows with CRLF", () => {
    const csv = toCsv(columns, [
      { name: "Aïcha", note: "ok" },
      { name: "Omar", note: "ok" },
    ]);
    expect(csv.slice(1)).toBe("Name,Note\r\nAïcha,ok\r\nOmar,ok");
  });

  it("quotes and escapes a value containing a comma", () => {
    const csv = toCsv(columns, [{ name: "Doe, John", note: "" }]);
    expect(csv.slice(1)).toContain('"Doe, John"');
  });

  it("quotes and doubles internal quotes", () => {
    const csv = toCsv(columns, [{ name: 'Say "hi"', note: "" }]);
    expect(csv.slice(1)).toContain('"Say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    const csv = toCsv(columns, [{ name: "line1\nline2", note: "" }]);
    expect(csv.slice(1)).toContain('"line1\nline2"');
  });

  it("falls back to an empty cell for a missing key", () => {
    const csv = toCsv(columns, [{ name: "Solo" }]);
    expect(csv.slice(1)).toBe("Name,Note\r\nSolo,");
  });
});
