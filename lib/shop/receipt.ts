// Pure text rendering of a checkout receipt for WhatsApp — no i18n or
// formatting library inside, so the caller passes already-translated labels
// and its own money/date formatters, and this stays trivially testable.

export type ReceiptLine = {
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
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentLabel: string;
  amountReceived: number | null;
};

export type ReceiptLabels = {
  reference: string;
  subtotal: string;
  discount: string;
  total: string;
  payment: string;
  amountReceived: string;
  change: string;
  thanks: string;
};

export function buildReceiptText(
  receipt: ReceiptData,
  labels: ReceiptLabels,
  money: (amount: number) => string,
): string {
  const lines = [
    receipt.boutiqueName,
    `${labels.reference}: ${receipt.reference}`,
    receipt.date,
    "",
    ...receipt.lines.map(
      (line) =>
        `- ${line.productName} (${line.size}, ${line.color}) x${line.quantity} — ${money(line.lineTotal)}`,
    ),
    "",
  ];

  if (receipt.discount > 0) {
    lines.push(`${labels.subtotal}: ${money(receipt.subtotal)}`);
    lines.push(`${labels.discount}: -${money(receipt.discount)}`);
  }
  lines.push(`${labels.total}: ${money(receipt.total)}`);
  lines.push(`${labels.payment}: ${receipt.paymentLabel}`);

  if (receipt.amountReceived !== null) {
    lines.push(`${labels.amountReceived}: ${money(receipt.amountReceived)}`);
    lines.push(`${labels.change}: ${money(receipt.amountReceived - receipt.total)}`);
  }

  lines.push("", labels.thanks);
  return lines.join("\n");
}
