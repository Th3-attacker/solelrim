import { describe, expect, it } from "vitest";
import { ExpectedError, expectedErrorCode } from "@/lib/errors";

describe("expectedErrorCode", () => {
  it("reads the code from the digest, which Next.js keeps in production", () => {
    // What a Server Component / Server Action error looks like in the browser
    // in production: a generic message, the original digest.
    const masked = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "licenseBlocked",
    });
    expect(expectedErrorCode(masked)).toBe("licenseBlocked");
  });

  it("reads it from the message too, as in development", () => {
    expect(expectedErrorCode(new Error("forbidden"))).toBe("forbidden");
  });

  it("is null for any other error", () => {
    expect(expectedErrorCode(new Error("boom"))).toBeNull();
    expect(expectedErrorCode(Object.assign(new Error("x"), { digest: "123456" }))).toBeNull();
    expect(expectedErrorCode("licenseBlocked")).toBeNull();
  });

  it("is what ExpectedError carries", () => {
    const error = new ExpectedError("unauthorized");
    expect(error.message).toBe("unauthorized");
    expect(error.digest).toBe("unauthorized");
    expect(expectedErrorCode(error)).toBe("unauthorized");
  });
});
