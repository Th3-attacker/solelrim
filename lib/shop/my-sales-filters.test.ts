import { describe, expect, it } from "vitest";
import { mySalesWhere, parseMySalesFilters } from "@/lib/shop/my-sales-filters";

describe("parseMySalesFilters", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseMySalesFilters({
        from: "2026-09-01",
        to: "2026-09-30",
        status: "CANCELLED",
        payment: "wallet:Bankily",
        q: " VNT-12 ",
      }),
    ).toEqual({
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-30T00:00:00Z"),
      status: "CANCELLED",
      payment: { method: "wallet", provider: "Bankily" },
      reference: "VNT-12",
    });
  });

  it("ignores anything malformed instead of trusting it", () => {
    expect(
      parseMySalesFilters({ from: "hier", status: "DELETED", payment: "wallet:", q: ["a", "b"] }),
    ).toEqual({ from: null, to: null, status: null, payment: null, reference: null });
  });
});

describe("mySalesWhere", () => {
  const NONE = parseMySalesFilters({});

  it("always pins the seller and the boutique from the session", () => {
    expect(mySalesWhere("sport", "seller-1", NONE)).toEqual({
      productType: "sport",
      sellerId: "seller-1",
    });
  });

  it("can only narrow further — no filter can widen to another seller or boutique", () => {
    const where = mySalesWhere(
      "sport",
      "seller-1",
      parseMySalesFilters({ payment: "cash", status: "COMPLETED", q: "VNT" }),
    );

    expect(where).toMatchObject({ productType: "sport", sellerId: "seller-1" });
    expect(where).toMatchObject({
      status: "COMPLETED",
      paymentMethod: "cash",
      reference: { contains: "VNT", mode: "insensitive" },
    });
  });

  it("includes the whole last day of the date range", () => {
    const where = mySalesWhere(
      "sport",
      "seller-1",
      parseMySalesFilters({ from: "2026-09-01", to: "2026-09-30" }),
    );

    expect(where.createdAt).toEqual({
      gte: new Date("2026-09-01T00:00:00Z"),
      lt: new Date("2026-10-01T00:00:00Z"),
    });
  });
});
