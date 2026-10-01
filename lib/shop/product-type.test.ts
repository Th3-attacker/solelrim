import { describe, expect, it } from "vitest";
import { RESERVED_STORE_TYPE_KEYS } from "@/lib/shop/product-type";

describe("RESERVED_STORE_TYPE_KEYS", () => {
  it("reserves the admin key so a boutique can never claim it", () => {
    expect(RESERVED_STORE_TYPE_KEYS.has("admin")).toBe(true);
  });
});
