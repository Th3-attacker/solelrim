// One receipt model for both the printed ticket and the WhatsApp text, so
// the two can never disagree on what's shown (discount rows, change, the
// cancelled marker). No i18n or formatting library inside: the caller
// passes translated labels and its own money formatter.

type ReceiptLine = {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  lineTotal: number;
};

export type ReceiptData = {
  boutiqueName: string;
  reference: string;
  date: string;
  cancelled: boolean;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  // The loyalty reward's discount, kept apart from the manual one.
  loyaltyDiscount: number;
  loyaltyPointsEarned: number;
  total: number;
  paymentLabel: string;
  amountReceived: number | null;
};

type ReceiptSummaryKey =
  | "subtotal"
  | "discount"
  | "loyaltyDiscount"
  | "total"
  | "payment"
  | "amountReceived"
  | "change"
  | "loyaltyPoints";

export type ReceiptLabels = Record<ReceiptSummaryKey, string> & {
  reference: string;
  cancelled: string;
  thanks: string;
};

export type ReceiptSummaryRow = { key: ReceiptSummaryKey; value: string; emphasis?: boolean };

export function buildReceiptSummary(
  receipt: ReceiptData,
  money: (amount: number) => string,
): ReceiptSummaryRow[] {
  const rows: ReceiptSummaryRow[] = [];
  if (receipt.discount > 0 || receipt.loyaltyDiscount > 0) {
    rows.push({ key: "subtotal", value: money(receipt.subtotal) });
  }
  if (receipt.discount > 0) {
    rows.push({ key: "discount", value: `-${money(receipt.discount)}` });
  }
  if (receipt.loyaltyDiscount > 0) {
    rows.push({ key: "loyaltyDiscount", value: `-${money(receipt.loyaltyDiscount)}` });
  }
  rows.push({ key: "total", value: money(receipt.total), emphasis: true });
  rows.push({ key: "payment", value: receipt.paymentLabel });
  if (receipt.amountReceived !== null) {
    rows.push({ key: "amountReceived", value: money(receipt.amountReceived) });
    rows.push({
      key: "change",
      value: money(Math.max(receipt.amountReceived - receipt.total, 0)),
    });
  }
  if (receipt.loyaltyPointsEarned > 0) {
    rows.push({ key: "loyaltyPoints", value: `+${receipt.loyaltyPointsEarned}` });
  }
  return rows;
}

export function buildReceiptText(
  receipt: ReceiptData,
  labels: ReceiptLabels,
  money: (amount: number) => string,
): string {
  const lines = [receipt.boutiqueName];
  if (receipt.cancelled) {
    lines.push(`*** ${labels.cancelled} ***`);
  }
  lines.push(`${labels.reference}: ${receipt.reference}`, receipt.date, "");
  for (const line of receipt.lines) {
    lines.push(
      `- ${line.productName} (${line.size}, ${line.color}) x${line.quantity} — ${money(line.lineTotal)}`,
    );
  }
  lines.push("");
  for (const row of buildReceiptSummary(receipt, money)) {
    lines.push(`${labels[row.key]}: ${row.value}`);
  }
  lines.push("", labels.thanks);
  return lines.join("\n");
}
