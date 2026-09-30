import { describe, expect, it } from "vitest";
import { auditChangeRows } from "@/lib/shop/audit-diff";

describe("auditChangeRows", () => {
  it("pairs each field's old and new value", () => {
    expect(
      auditChangeRows({ status: "COMPLETED" }, { status: "CANCELLED", restockedItems: 3 }),
    ).toEqual([
      { field: "status", before: "COMPLETED", after: "CANCELLED" },
      { field: "restockedItems", after: 3 },
    ]);
  });

  it("keeps a null value distinct from a missing one", () => {
    expect(auditChangeRows(null, { walletProvider: null })).toEqual([
      { field: "walletProvider", after: null },
    ]);
  });

  it("has no rows for an entry written before values were recorded", () => {
    expect(auditChangeRows(null, null)).toEqual([]);
  });
});
