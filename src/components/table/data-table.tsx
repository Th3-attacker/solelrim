import type { ReactNode } from "react";
import {
  createColumnHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type ReactTable,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "~/lib/cn";
import { Icon } from "~/components/ui/icon";
import { Button } from "~/components/ui/button";

type AdminColumnMeta = {
  // Amounts and counts line up on the end side.
  align?: "end";
  // The column that names the row, as a row header for screen readers.
  rowHeader?: boolean;
};

// Every admin list: rows selectable for bulk actions, columns sortable. The
// server does the sorting and paging (from the address); the table only
// holds which rows are ticked and renders accessible markup.
export const adminTableFeatures = tableFeatures({
  rowSelectionFeature,
  rowSortingFeature,
  columnMeta: {} as AdminColumnMeta,
});

export type AdminTable<TData extends RowData> = ReactTable<typeof adminTableFeatures, TData>;

export function adminColumns<TData extends RowData>() {
  return createColumnHelper<typeof adminTableFeatures, TData>();
}

// The tick-box column: one per row, and "all on this page" in the header.
export function selectionColumn<TData extends RowData>({
  selectAllLabel,
  rowLabel,
}: {
  selectAllLabel: string;
  rowLabel: (row: TData) => string;
}) {
  return adminColumns<TData>().display({
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label={selectAllLabel}
        className="size-4 cursor-pointer accent-brand"
        checked={table.getIsAllRowsSelected()}
        ref={(input) => {
          if (input) input.indeterminate = table.getIsSomeRowsSelected();
        }}
        onChange={(event) => table.toggleAllRowsSelected(event.target.checked)}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={rowLabel(row.original)}
        className="size-4 cursor-pointer accent-brand"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  });
}

export function DataTable<TData extends RowData>({
  table,
  caption,
  busy = false,
  empty,
  selectionBar,
}: {
  table: AdminTable<TData>;
  // Says what the table lists; read by screen readers, not shown.
  caption: string;
  // A newer page is on its way: the current one stays, dimmed.
  busy?: boolean;
  empty?: ReactNode;
  // Shown above the table while rows are ticked (count and bulk actions).
  selectionBar?: (selected: TData[]) => ReactNode;
}) {
  const rows = table.getRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div>
      {selectionBar && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-brand px-4 py-2.5 text-[14px] text-on-brand">
          {selectionBar(selected)}
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          aria-busy={busy || undefined}
          className={cn(
            "w-full border-collapse text-[14px] tabular-nums transition-opacity",
            busy && "opacity-60",
          )}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const column = header.column;
                  const sorted = column.getIsSorted();
                  const align = column.columnDef.meta?.align;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "border-b border-line-soft bg-surface-2 px-4 py-2.5 text-start text-[12px] font-medium whitespace-nowrap text-muted",
                        align === "end" && "text-end",
                        column.id === "select" && "w-4",
                      )}
                    >
                      {header.isPlaceholder ? null : column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded font-medium hover:text-ink"
                        >
                          <table.FlexRender header={header} />
                          <Icon
                            name={sorted === "asc" ? "chevronDown" : "selector"}
                            className={cn(
                              "size-3.5",
                              sorted === "asc" && "rotate-180",
                              !sorted && "opacity-50",
                            )}
                          />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "hover:bg-surface-2 [&:last-child>*]:border-b-0",
                  row.getIsSelected() && "bg-tint-soft hover:bg-tint-soft",
                )}
              >
                {row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const Cell = meta?.rowHeader ? "th" : "td";
                  return (
                    <Cell
                      key={cell.id}
                      scope={meta?.rowHeader ? "row" : undefined}
                      className={cn(
                        "border-b border-line-soft px-4 py-3 text-start font-normal whitespace-nowrap",
                        meta?.align === "end" && "text-end",
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && empty}
    </div>
  );
}

// "1–20 sur 28" and the way to the pages around it.
export function Pagination({
  page,
  pageSize,
  total,
  rangeLabel,
  previousLabel,
  nextLabel,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  rangeLabel: (range: { from: number; to: number; total: number }) => string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      aria-label={rangeLabel({ from, to, total })}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[13px] text-muted"
    >
      <p aria-live="polite">{rangeLabel({ from, to, total })}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevronLeft" className="size-3.5" />
          {previousLabel}
        </Button>
        <Button size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          {nextLabel}
          <Icon name="chevronRight" className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}
