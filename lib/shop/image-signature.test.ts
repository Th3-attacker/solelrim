import { describe, expect, it } from "vitest";
import { detectImageSignature } from "@/lib/shop/image-signature";

describe("detectImageSignature", () => {
  it("detects a JPEG from its magic bytes", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageSignature(bytes)).toEqual({
      type: "jpeg",
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("detects a PNG from its magic bytes", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageSignature(bytes)).toEqual({
      type: "png",
      contentType: "image/png",
      extension: "png",
    });
  });

  it("detects a WebP from its RIFF/WEBP markers", () => {
    // RIFF <4-byte size, irrelevant here> WEBP
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectImageSignature(bytes)).toEqual({
      type: "webp",
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("returns null for a GIF, since no bucket accepts that format", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectImageSignature(bytes)).toBeNull();
  });

  it("returns null for content that isn't a recognized image format", () => {
    const bytes = new Uint8Array(Buffer.from("not-actually-an-image"));
    expect(detectImageSignature(bytes)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectImageSignature(new Uint8Array())).toBeNull();
  });

  it("does not confuse a RIFF file that isn't WebP (e.g. WAV) with a match", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]); // "RIFF....WAVE"
    expect(detectImageSignature(bytes)).toBeNull();
  });
});
