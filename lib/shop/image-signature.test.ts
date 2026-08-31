import { describe, expect, it } from "vitest";
import {
  detectImageSignature,
  isImageTooLarge,
  readImageDimensions,
  validateImageBytes,
} from "@/lib/shop/image-signature";

// [8-byte PNG sig][IHDR length + type][width BE][height BE]
function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

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

describe("readImageDimensions", () => {
  it("reads width/height from a PNG IHDR", () => {
    expect(readImageDimensions(pngHeader(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("returns null for a header too short to parse", () => {
    expect(readImageDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("isImageTooLarge / validateImageBytes", () => {
  it("passes a normal-sized photo", () => {
    const bytes = pngHeader(4032, 3024); // 12 MP phone camera
    expect(isImageTooLarge(bytes)).toBe(false);
    expect(validateImageBytes(bytes)).toEqual({
      type: "png",
      contentType: "image/png",
      extension: "png",
    });
  });

  it("rejects a decompression bomb: tiny file, huge declared canvas", () => {
    const bytes = pngHeader(50000, 50000); // 2.5 gigapixels
    expect(isImageTooLarge(bytes)).toBe(true);
    expect(validateImageBytes(bytes)).toBeNull();
  });

  it("does not block an image whose dimensions can't be determined", () => {
    // valid JPEG magic bytes, no parseable SOF segment
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isImageTooLarge(bytes)).toBe(false);
    expect(validateImageBytes(bytes)).toEqual({
      type: "jpeg",
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });
});
