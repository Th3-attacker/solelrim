// No "use client": rendered by server pages, which pass their own money
// formatter (a function can't cross into a client component).
// Signed, coloured cash difference: red for a shortfall, plain for none.
export function CashDifference({
  value,
  format,
}: {
  value: number | null;
  format: (amount: number) => string;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span dir="ltr" className={value < 0 ? "font-medium text-destructive tabular-nums" : "tabular-nums"}>
      {value > 0 ? "+" : value < 0 ? "-" : ""}
      {format(Math.abs(value))}
    </span>
  );
}
