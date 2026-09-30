import { describe, expect, it } from "vitest";
import { normalizeLocalPhone } from "@/lib/shop/phone";

describe("normalizeLocalPhone", () => {
  it("keeps a bare 8-digit local number", () => {
    expect(normalizeLocalPhone("22123456")).toBe("22123456");
  });

  it("strips spaces, dashes and the +222 country code", () => {
    expect(normalizeLocalPhone("+222 22 12 34 56")).toBe("22123456");
    expect(normalizeLocalPhone("22-12-34-56")).toBe("22123456");
  });

  it("rejects anything that isn't a Mauritanian mobile number", () => {
    expect(normalizeLocalPhone("12345678")).toBeNull();
    expect(normalizeLocalPhone("2212345")).toBeNull();
    expect(normalizeLocalPhone("")).toBeNull();
  });
});
