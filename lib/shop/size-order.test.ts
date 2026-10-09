import { describe, expect, it } from "vitest";
import { sortBySize } from "@/lib/shop/size-order";

const sizes = (list: string[]) => sortBySize(list, (s) => s);

describe("sortBySize", () => {
  it("puts letter sizes in wearing order, whatever the case", () => {
    expect(sizes(["L", "m", "XL", "S", "XXS", "3XL"])).toEqual(["XXS", "S", "m", "L", "XL", "3XL"]);
  });

  it("orders numeric sizes by value, not as text", () => {
    expect(sizes(["42", "38", "40,5", "9"])).toEqual(["9", "38", "40,5", "42"]);
  });

  it("puts letters, then numbers, then the rest in entry order", () => {
    expect(sizes(["TU", "40", "M", "6 ans", "S"])).toEqual(["S", "M", "40", "TU", "6 ans"]);
  });

  it("keeps the input order for equal sizes", () => {
    const variants = [
      { size: "M", color: "Noir" },
      { size: "S", color: "Blanc" },
      { size: "M", color: "Blanc" },
    ];
    expect(sortBySize(variants, (v) => v.size).map((v) => v.color)).toEqual(["Blanc", "Noir", "Blanc"]);
  });
});
