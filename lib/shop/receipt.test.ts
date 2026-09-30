import { describe, expect, it } from "vitest";
import { buildReceiptSummary, buildReceiptText, type ReceiptData } from "@/lib/shop/receipt";

const LABELS = {
  reference: "Réf",
  subtotal: "Sous-total",
  discount: "Remise",
  loyaltyDiscount: "Récompense fidélité",
  loyaltyPoints: "Points gagnés",
  total: "Total",
  payment: "Paiement",
  amountReceived: "Reçu",
  change: "Rendu",
  cancelled: "VENTE ANNULÉE",
  thanks: "Merci !",
};

const money = (amount: number) => `${amount} MRU`;

const BASE: ReceiptData = {
  boutiqueName: "Maison Lune",
  reference: "VNT-20260930-0001",
  date: "30/09/2026 10:00",
  cancelled: false,
  lines: [{ productName: "Robe Isla", size: "M", color: "Noir", quantity: 2, lineTotal: 2400 }],
  subtotal: 2400,
  discount: 0,
  loyaltyDiscount: 0,
  loyaltyPointsEarned: 0,
  total: 2400,
  paymentLabel: "Espèces",
  amountReceived: null,
};

describe("buildReceiptSummary", () => {
  it("shows subtotal and discount only when a discount was applied", () => {
    expect(buildReceiptSummary(BASE, money).map((row) => row.key)).toEqual(["total", "payment"]);

    const rows = buildReceiptSummary({ ...BASE, discount: 400, total: 2000 }, money);

    expect(rows.map((row) => row.key)).toEqual(["subtotal", "discount", "total", "payment"]);
    expect(rows[1].value).toBe("-400 MRU");
  });

  it("shows cash received and change when the amount handed over was entered", () => {
    const rows = buildReceiptSummary({ ...BASE, amountReceived: 3000 }, money);

    expect(rows.slice(-2)).toEqual([
      { key: "amountReceived", value: "3000 MRU" },
      { key: "change", value: "600 MRU" },
    ]);
  });

  it("shows the loyalty reward apart from the manual discount, and the points earned last", () => {
    const rows = buildReceiptSummary(
      { ...BASE, discount: 200, loyaltyDiscount: 1000, total: 1200, loyaltyPointsEarned: 12 },
      money,
    );

    expect(rows.map((row) => row.key)).toEqual([
      "subtotal",
      "discount",
      "loyaltyDiscount",
      "total",
      "payment",
      "loyaltyPoints",
    ]);
    expect(rows[2].value).toBe("-1000 MRU");
    expect(rows.at(-1)?.value).toBe("+12");
  });

  it("shows the subtotal when only the loyalty reward applied", () => {
    const rows = buildReceiptSummary({ ...BASE, loyaltyDiscount: 1000, total: 1400 }, money);

    expect(rows.map((row) => row.key)).toEqual(["subtotal", "loyaltyDiscount", "total", "payment"]);
  });

  it("never shows negative change", () => {
    const rows = buildReceiptSummary({ ...BASE, amountReceived: 2000 }, money);

    expect(rows.at(-1)).toEqual({ key: "change", value: "0 MRU" });
  });
});

describe("buildReceiptText", () => {
  it("lists every line, the totals, and the thanks", () => {
    const text = buildReceiptText(BASE, LABELS, money);

    expect(text).toContain("Réf: VNT-20260930-0001");
    expect(text).toContain("- Robe Isla (M, Noir) x2 — 2400 MRU");
    expect(text).toContain("Total: 2400 MRU");
    expect(text).toContain("Paiement: Espèces");
    expect(text.endsWith("Merci !")).toBe(true);
    expect(text).not.toContain("ANNULÉE");
  });

  it("marks a cancelled sale right under the boutique name", () => {
    const text = buildReceiptText({ ...BASE, cancelled: true }, LABELS, money);

    expect(text.split("\n")[1]).toBe("*** VENTE ANNULÉE ***");
  });
});
