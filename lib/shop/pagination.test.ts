import { describe, expect, it } from "vitest";
import { toPageNumber } from "@/lib/shop/pagination";

describe("toPageNumber", () => {
  it("keeps a valid page", () => {
    expect(toPageNumber(3)).toBe(3);
  });

  it("turns anything the query can't take into a real page", () => {
    expect(toPageNumber(1.5)).toBe(1);
    expect(toPageNumber(-3)).toBe(1);
    expect(toPageNumber(Number("abc"))).toBe(1);
    expect(toPageNumber(Infinity)).toBe(1);
    expect(toPageNumber(undefined)).toBe(1);
  });
});
