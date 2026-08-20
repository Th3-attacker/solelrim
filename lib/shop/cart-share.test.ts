import { describe, expect, it } from "vitest";
import { buildCartShareText } from "@/lib/shop/cart-share";

describe("buildCartShareText", () => {
  it("lists each line and the total, in the caller's own locale", () => {
    const text = buildCartShareText(
      [
        { productName: "Robe", size: "M", color: "Rose", quantity: 2, unitPrice: 1500 },
        { productName: "Foulard", size: "Unique", color: "Bleu", quantity: 1, unitPrice: 800 },
      ],
      3800,
      "MRU",
      "Total :",
    );

    const lines = text.split("\n");
    expect(lines[0]).toContain("Robe (M, Rose) x2");
    expect(lines[1]).toContain("Foulard (Unique, Bleu) x1");
    expect(lines.at(-1)).toBe("Total : 3.800 MRU");
  });

  it("handles a single item with no trailing artifacts", () => {
    const text = buildCartShareText(
      [{ productName: "Sac", size: "Unique", color: "Noir", quantity: 1, unitPrice: 2000 }],
      2000,
      "MRU",
      "Total:",
    );

    expect(text).toContain("- Sac (Unique, Noir) x1");
    expect(text).toContain("Total:");
  });
});
