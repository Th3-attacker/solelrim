"use client";

import { Download } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { toCsv, type CsvColumn } from "@/lib/shop/csv";

export function ExportCsvButton({
  label,
  filename,
  columns,
  rows,
}: {
  label: string;
  filename: string;
  columns: CsvColumn[];
  rows: Record<string, string | number>[];
}) {
  function handleExport() {
    const csv = toCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
