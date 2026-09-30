import { describe, expect, it } from "vitest";
import {
  buildPaymentBreakdown,
  businessDateOf,
  cashDifference,
  combineSessionTotals,
  computeSessionTotals,
  parseBusinessDate,
} from "@/lib/shop/cash";

describe("buildPaymentBreakdown", () => {
  it("lists cash first, then every boutique wallet even at zero", () => {
    const rows = buildPaymentBreakdown(
      [
        { paymentMethod: "wallet", walletProvider: "Masrvi", total: 500, count: 1 },
        { paymentMethod: "cash", walletProvider: null, total: 1200, count: 3 },
      ],
      ["Bankily", "Masrvi"],
    );

    expect(rows).toEqual([
      { method: "cash", provider: null, total: 1200, count: 3 },
      { method: "wallet", provider: "Bankily", total: 0, count: 0 },
      { method: "wallet", provider: "Masrvi", total: 500, count: 1 },
    ]);
  });

  it("keeps a wallet the boutique has since removed, and legacy methods apart", () => {
    const rows = buildPaymentBreakdown(
      [
        { paymentMethod: "wallet", walletProvider: "Sedad", total: 300, count: 1 },
        { paymentMethod: "card", walletProvider: null, total: 100, count: 1 },
        { paymentMethod: null, walletProvider: null, total: 50, count: 1 },
      ],
      ["Bankily"],
    );

    expect(rows.map((row) => [row.method, row.provider, row.total])).toEqual([
      ["cash", null, 0],
      ["wallet", "Bankily", 0],
      ["wallet", "Sedad", 300],
      ["other", null, 150],
    ]);
  });
});

describe("computeSessionTotals", () => {
  it("expects float + cash sales + money in − money out, ignoring wallet sales", () => {
    const totals = computeSessionTotals({
      openingFloat: 2000,
      groups: [
        { paymentMethod: "cash", walletProvider: null, total: 1500.5, count: 2 },
        { paymentMethod: "wallet", walletProvider: "Bankily", total: 4000, count: 1 },
      ],
      walletProviders: ["Bankily"],
      cashIn: 500,
      cashOut: 300,
    });

    expect(totals.expectedCash).toBe(3700.5);
    expect(totals.salesTotal).toBe(5500.5);
    expect(totals.salesCount).toBe(3);
  });
});

describe("combineSessionTotals", () => {
  it("adds up every seller's till into one day, merging the same wallet", () => {
    const day = combineSessionTotals([
      computeSessionTotals({
        openingFloat: 1000,
        groups: [{ paymentMethod: "cash", walletProvider: null, total: 700, count: 1 }],
        walletProviders: ["Bankily"],
        cashIn: 0,
        cashOut: 200,
      }),
      computeSessionTotals({
        openingFloat: 500,
        groups: [{ paymentMethod: "wallet", walletProvider: "Bankily", total: 900, count: 2 }],
        walletProviders: ["Bankily"],
        cashIn: 100,
        cashOut: 0,
      }),
    ]);

    expect(day.openingFloat).toBe(1500);
    expect(day.expectedCash).toBe(2100);
    expect(day.salesTotal).toBe(1600);
    expect(day.breakdown).toEqual([
      { method: "cash", provider: null, total: 700, count: 1 },
      { method: "wallet", provider: "Bankily", total: 900, count: 2 },
    ]);
  });
});

describe("cashDifference", () => {
  it("is negative for a shortfall and positive for an excess, to the cent", () => {
    expect(cashDifference(3650, 3700.5)).toBe(-50.5);
    expect(cashDifference(3710, 3700.5)).toBe(9.5);
    expect(cashDifference(0.3, 0.1 + 0.2)).toBe(0);
  });
});

describe("business dates", () => {
  it("uses the UTC calendar day (Mauritania has no offset)", () => {
    expect(businessDateOf(new Date("2026-09-30T23:59:00Z")).toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
  });

  it("parses only real YYYY-MM-DD dates", () => {
    expect(parseBusinessDate("2026-09-30")?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(parseBusinessDate("2026-02-30")).toBeNull();
    expect(parseBusinessDate("30/09/2026")).toBeNull();
  });
});
