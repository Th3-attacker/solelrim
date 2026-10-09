import { describe, expect, it } from "vitest";
import { mailtoLink, whatsappLink } from "@/lib/help/support-links";

describe("whatsappLink", () => {
  it("adds the Mauritanian prefix to a local 8-digit number", () => {
    expect(whatsappLink("22 33 44 55", "Salut")).toBe("https://wa.me/22222334455?text=Salut");
  });

  it("keeps a number that already has its country code, however it is typed", () => {
    expect(whatsappLink("+222 22 33 44 55", "a")).toBe("https://wa.me/22222334455?text=a");
    expect(whatsappLink("00222 22334455", "a")).toBe("https://wa.me/22222334455?text=a");
  });

  it("encodes the message", () => {
    expect(whatsappLink("22334455", "a b&c")).toContain("text=a%20b%26c");
  });

  it("gives no link without a usable number", () => {
    expect(whatsappLink("", "x")).toBeNull();
    expect(whatsappLink(null, "x")).toBeNull();
    expect(whatsappLink("123", "x")).toBeNull();
  });
});

describe("mailtoLink", () => {
  it("encodes the subject and the body", () => {
    expect(mailtoLink("help@solal.mr", "Aide: a b", "Ligne 1\nLigne 2")).toBe(
      "mailto:help@solal.mr?subject=Aide%3A%20a%20b&body=Ligne%201%0ALigne%202",
    );
  });

  it("gives no link without an e-mail address", () => {
    expect(mailtoLink("", "s", "b")).toBeNull();
    expect(mailtoLink("not-an-email", "s", "b")).toBeNull();
    expect(mailtoLink(undefined, "s", "b")).toBeNull();
  });
});
