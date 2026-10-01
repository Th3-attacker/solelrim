import { describe, expect, it } from "vitest";
import { computeRefund, type RefundSaleLine } from "@/lib/shop/refund";

// 2 × 600 + 1 × 800 = 2 000 subtotal; 200 discount → 1 800 paid.
function lines(refund: [number, number]): RefundSaleLine[] {
  return [
    { saleItemId: "a", unitPrice: 600, quantity: 2, refundedQuantity: 0, refundQuantity: refund[0] },
    { saleItemId: "b", unitPrice: 800, quantity: 1, refundedQuantity: 0, refundQuantity: refund[1] },
  ];
}

const SALE = {
  subtotal: 2000,
  total: 1800,
  refundedAmount: 0,
  loyaltyPointsEarned: 18,
  loyaltyPointsRedeemed: 100,
  previousPointsTakenBack: 0,
  previousPointsReturned: 0,
};

describe("computeRefund", () => {
  it("refunds a line's share of what was actually paid, discount included", () => {
    expect(computeRefund({ ...SALE, lines: lines([1, 0]) })).toEqual({
      amount: 540,
      allRefunded: false,
      loyaltyPointsTakenBack: 5,
      loyaltyPointsReturned: 30,
    });
  });

  it("refunds everything that's left, to the cent and the point, on the last units", () => {
    const result = computeRefund({
      ...SALE,
      refundedAmount: 540,
      previousPointsTakenBack: 5,
      previousPointsReturned: 30,
      lines: [
        { saleItemId: "a", unitPrice: 600, quantity: 2, refundedQuantity: 1, refundQuantity: 1 },
        { saleItemId: "b", unitPrice: 800, quantity: 1, refundedQuantity: 0, refundQuantity: 1 },
      ],
    });

    expect(result).toEqual({
      amount: 1260,
      allRefunded: true,
      loyaltyPointsTakenBack: 13,
      loyaltyPointsReturned: 70,
    });
  });

  it("refunds the whole sale in one go", () => {
    expect(computeRefund({ ...SALE, lines: lines([2, 1]) })?.amount).toBe(1800);
  });

  it("refuses more than what's left to refund, or nothing at all", () => {
    expect(computeRefund({ ...SALE, lines: lines([3, 0]) })).toBeNull();
    expect(
      computeRefund({
        ...SALE,
        lines: [
          { saleItemId: "a", unitPrice: 600, quantity: 2, refundedQuantity: 2, refundQuantity: 1 },
        ],
      }),
    ).toBeNull();
    expect(computeRefund({ ...SALE, lines: lines([0, 0]) })).toBeNull();
    expect(computeRefund({ ...SALE, lines: lines([-1, 0]) })).toBeNull();
    expect(computeRefund({ ...SALE, lines: lines([0.5, 0]) })).toBeNull();
  });

  it("gives nothing back for a free sale", () => {
    const result = computeRefund({
      ...SALE,
      total: 0,
      loyaltyPointsEarned: 0,
      lines: lines([1, 0]),
    });

    expect(result?.amount).toBe(0);
  });
});
