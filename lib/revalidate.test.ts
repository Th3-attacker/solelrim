import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { revalidatePath } from "next/cache";
import { revalidateAdmin, revalidateSite, revalidateStorefront } from "@/lib/revalidate";

const revalidatePathMock = revalidatePath as unknown as Mock;

beforeEach(() => revalidatePathMock.mockReset());

describe("revalidate helpers", () => {
  // Chaque helper nomme un vrai dossier de routes (src/routes).
  it.each([
    ["admin", revalidateAdmin],
    ["storefront", revalidateStorefront],
    ["site", revalidateSite],
  ])("%s names a real route segment", (_, helper) => {
    helper();
    const [pattern, type] = revalidatePathMock.mock.calls[0];
    expect(type).toBe("layout");
    expect(existsSync(path.join(__dirname, "..", "src", "routes", pattern))).toBe(true);
  });
});
