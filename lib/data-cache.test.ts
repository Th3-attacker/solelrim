import { describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { decodeCached, encodeCached } from "@/lib/data-cache";

describe("encodeCached / decodeCached", () => {
  it("brings Decimals and Dates back as themselves, at any depth", () => {
    const row = {
      basePrice: new Prisma.Decimal("1500.50"),
      createdAt: new Date("2026-10-13T10:00:00.000Z"),
      variants: [{ price: null, stock: 3, updatedAt: new Date("2026-10-12T00:00:00.000Z") }],
      name: "T-shirt",
    };

    const back = decodeCached<typeof row>(encodeCached(row));

    expect(back.basePrice).toBeInstanceOf(Prisma.Decimal);
    expect(back.basePrice.toNumber()).toBe(1500.5);
    expect(back.createdAt).toBeInstanceOf(Date);
    expect(back.createdAt.getTime()).toBe(row.createdAt.getTime());
    expect(back.variants[0].updatedAt).toBeInstanceOf(Date);
    expect(back.variants[0].price).toBeNull();
    expect(back.name).toBe("T-shirt");
  });

  it("keeps null and arrays as they are", () => {
    expect(decodeCached(encodeCached(null))).toBeNull();
    expect(decodeCached(encodeCached([1, "a"]))).toEqual([1, "a"]);
  });
});
