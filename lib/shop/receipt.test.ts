import { describe, expect, it } from "vitest";
import { buildReceiptText, type ReceiptData } from "@/lib/shop/receipt";

const LABELS = {
  reference: "Réf",
  subtotal: "Sous-total",
  discount: "Remise",
  total: "Total",
  payment: "Paiement",
  amountReceived: "Reçu",
  change: "Rendu",
  thanks: "Merci !",
};

const money = (amount: number) => `${amount} MRU`;

const BASE: ReceiptData = {
  boutiqueName: "Maison Lune",
  reference: "VNT-20260930-0001",
  date: "30/09/2026 10:00",
  lines: [{ productName: "Robe Isla", size: "M", color: "Noir", quantity: 2, lineTotal: 2400 }],
  subtotal: 2400,
  discount: 0,
  total: 2400,
  paymentLabel: "Espèces",
  amountReceived: null,
};

describe("buildReceiptText", () => {
  it("lists every line with its quantity and line total", () => {
    const text = buildReceiptText(BASE, LABELS, money);

    expect(text).toContain("Maison Lune");
    expect(text).toContain("Réf: VNT-20260930-0001");
    expect(text).toContain("- Robe Isla (M, Noir) x2 — 2400 MRU");
    expect(text).toContain("Total: 2400 MRU");
    expect(text).toContain("Paiement: Espèces");
    expect(text.endsWith("Merci !")).toBe(true);
  });

  it("shows subtotal and discount only when a discount was applied", () => {
    expect(buildReceiptText(BASE, LABELS, money)).not.toContain("Remise");

    const text = buildReceiptText({ ...BASE, discount: 400, total: 2000 }, LABELS, money);

    expect(text).toContain("Sous-total: 2400 MRU");
    expect(text).toContain("Remise: -400 MRU");
    expect(text).toContain("Total: 2000 MRU");
  });

  it("shows cash received and change when the amount handed over was entered", () => {
    const text = buildReceiptText({ ...BASE, amountReceived: 3000 }, LABELS, money);

    expect(text).toContain("Reçu: 3000 MRU");
    expect(text).toContain("Rendu: 600 MRU");
  });
});
