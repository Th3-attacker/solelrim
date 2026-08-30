// Matches the Supabase Storage bucket's own fileSizeLimit for
// product-images (see scripts/setup-supabase.ts) — checked here too so a
// too-large branding/product/wallet image fails fast with the app's own
// "invalidFile" error instead of an opaque Storage rejection.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Detects an image's real format from its magic bytes, instead of trusting
// the client-declared File.type (or the filename extension) — both are
// just metadata the uploader controls and say nothing about what's
// actually in the file.
export type DetectedImage = {
  type: "jpeg" | "png" | "webp";
  contentType: string;
  extension: string;
};

const SIGNATURES: (DetectedImage & { matches: (bytes: Uint8Array) => boolean })[] = [
  {
    type: "jpeg",
    contentType: "image/jpeg",
    extension: "jpg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: "png",
    contentType: "image/png",
    extension: "png",
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    type: "webp",
    contentType: "image/webp",
    extension: "webp",
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && // "RIFF"
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 && // "WEBP"
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

export function detectImageSignature(bytes: Uint8Array): DetectedImage | null {
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!match) return null;
  const { type, contentType, extension } = match;
  return { type, contentType, extension };
}

// A file can pass the magic-byte check above at a few KB yet declare a
// canvas of tens of thousands of pixels a side — a "decompression bomb"
// that stays small on disk but blows up memory/CPU the moment anything
// (Next's image optimizer on the public storefront, a thumbnailer) decodes
// it. ~40 MP is far past any real product/logo/payment photo (a 12 MP phone
// camera is 4032×3024) and far below bomb territory.
export const MAX_IMAGE_PIXELS = 40_000_000;

function u32be(b: Uint8Array, o: number): number {
  return (b[o] * 2 ** 24 + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]) >>> 0;
}

// Reads the pixel dimensions straight from the format header. Best-effort:
// returns null on anything it can't parse (truncated header, an exotic
// variant), so an unparseable file is judged by the other checks rather
// than blocked here — a real bomb always carries a valid, huge header.
export function readImageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  try {
    // PNG — IHDR is always the first chunk: [8 sig][4 len]["IHDR"][4 w][4 h]
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length >= 24) {
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }

    // JPEG — walk the segment markers to the first Start-Of-Frame
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let o = 2;
      while (o + 9 < bytes.length) {
        if (bytes[o] !== 0xff) return null;
        const marker = bytes[o + 1];
        // standalone markers (RSTn, SOI, EOI, TEM) carry no length
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          o += 2;
          continue;
        }
        const len = (bytes[o + 2] << 8) + bytes[o + 3];
        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        if (isSof) {
          const height = (bytes[o + 5] << 8) + bytes[o + 6];
          const width = (bytes[o + 7] << 8) + bytes[o + 8];
          return { width, height };
        }
        if (marker === 0xda) return null; // hit scan data, no SOF
        o += 2 + len;
      }
      return null;
    }

    // WebP — RIFF????WEBP then a VP8 / VP8L / VP8X chunk
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes.length >= 30) {
      const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (fourCC === "VP8 ") {
        const width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff) + 0;
        const height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff) + 0;
        return { width, height };
      }
      if (fourCC === "VP8L") {
        const b = bytes.subarray(21, 25);
        const width = 1 + (((b[1] & 0x3f) << 8) | b[0]);
        const height = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | (b[1] >> 6));
        return { width, height };
      }
      if (fourCC === "VP8X") {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

// True when the header declares more pixels than MAX_IMAGE_PIXELS. Undecided
// (unparseable header) is not a bomb — see readImageDimensions.
export function isImageTooLarge(bytes: Uint8Array): boolean {
  const dims = readImageDimensions(bytes);
  return dims !== null && dims.width * dims.height > MAX_IMAGE_PIXELS;
}

// The single check every upload path runs on the raw bytes: real image
// format (not a renamed something-else) AND not a decompression bomb.
// Returns null — i.e. "invalidFile" — for either failure.
export function validateImageBytes(bytes: Uint8Array): DetectedImage | null {
  const detected = detectImageSignature(bytes);
  if (!detected || isImageTooLarge(bytes)) return null;
  return detected;
}
