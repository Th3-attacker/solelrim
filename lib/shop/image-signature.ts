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
  type: "jpeg" | "png" | "webp" | "gif";
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
  {
    type: "gif",
    contentType: "image/gif",
    extension: "gif",
    matches: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 && // "GIF8"
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && // "7" or "9"
      b[5] === 0x61, // "a"
  },
];

export function detectImageSignature(bytes: Uint8Array): DetectedImage | null {
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!match) return null;
  const { type, contentType, extension } = match;
  return { type, contentType, extension };
}
