import { describe, expect, it } from "vitest";
import { encodeCartEntries, decodeCartEntries } from "@/lib/shop/cart-link";

describe("encodeCartEntries / decodeCartEntries", () => {
  it("round-trips a list of entries", () => {
    const entries = [
      { variantId: "cvariant1", quantity: 2 },
      { variantId: "cvariant2", quantity: 1 },
    ];

    expect(decodeCartEntries(encodeCartEntries(entries))).toEqual(entries);
  });

  it("drops malformed pairs instead of throwing", () => {
    expect(decodeCartEntries("abc:2,not-a-pair,def:0,:3,ghi:-1")).toEqual([
      { variantId: "abc", quantity: 2 },
    ]);
  });

  it("returns an empty list for an empty string", () => {
    expect(decodeCartEntries("")).toEqual([]);
  });
});
