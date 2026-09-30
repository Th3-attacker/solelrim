import { roundMoney } from "@/lib/shop/cash";

export type RefundSaleLine = {
  saleItemId: string;
  unitPrice: number;
  quantity: number;
  refundedQuantity: number;
  // Units refunded by this request (0 for lines it doesn't touch).
  refundQuantity: number;
};

export type RefundComputation = {
  amount: number;
  // Every unit of every line refunded once this one is applied.
  allRefunded: boolean;
  loyaltyPointsTakenBack: number;
  loyaltyPointsReturned: number;
};

// What a refund gives back, prorated on the refunded lines' share of the
// sale's subtotal — so the manual discount and the loyalty reward are
// shared out the same way. The request that refunds the last unit takes
// whatever is left, so rounding never leaves a cent (or a point) behind.
// Returns null when a quantity is out of range.
export function computeRefund(input: {
  subtotal: number;
  total: number;
  refundedAmount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  // Points already moved by previously approved refunds of this sale.
  previousPointsTakenBack: number;
  previousPointsReturned: number;
  lines: RefundSaleLine[];
}): RefundComputation | null {
  const touched = input.lines.filter((line) => line.refundQuantity !== 0);
  if (touched.length === 0) return null;
  for (const line of touched) {
    if (
      !Number.isInteger(line.refundQuantity) ||
      line.refundQuantity < 0 ||
      line.refundQuantity > line.quantity - line.refundedQuantity
    ) {
      return null;
    }
  }

  const allRefunded = input.lines.every(
    (line) => line.refundedQuantity + line.refundQuantity === line.quantity,
  );
  const remainingAmount = roundMoney(input.total - input.refundedAmount);
  const pointsLeftToTake = input.loyaltyPointsEarned - input.previousPointsTakenBack;
  const pointsLeftToReturn = input.loyaltyPointsRedeemed - input.previousPointsReturned;

  if (allRefunded) {
    return {
      amount: remainingAmount,
      allRefunded,
      loyaltyPointsTakenBack: Math.max(pointsLeftToTake, 0),
      loyaltyPointsReturned: Math.max(pointsLeftToReturn, 0),
    };
  }

  const share =
    input.subtotal > 0
      ? touched.reduce((sum, line) => sum + line.unitPrice * line.refundQuantity, 0) /
        input.subtotal
      : 0;
  return {
    amount: Math.min(roundMoney(input.total * share), remainingAmount),
    allRefunded,
    loyaltyPointsTakenBack: Math.max(
      Math.min(Math.floor(input.loyaltyPointsEarned * share), pointsLeftToTake),
      0,
    ),
    loyaltyPointsReturned: Math.max(
      Math.min(Math.floor(input.loyaltyPointsRedeemed * share), pointsLeftToReturn),
      0,
    ),
  };
}
