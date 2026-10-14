import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a design text size next to a text color", () => {
    expect(cn("text-page-title", "text-muted")).toBe("text-page-title text-muted");
  });

  it("lets a later design size replace an earlier one", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
    expect(cn("rounded-control", "rounded-card")).toBe("rounded-card");
  });
});
