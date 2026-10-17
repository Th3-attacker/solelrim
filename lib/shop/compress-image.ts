// Resizes and re-encodes an image in the browser before it is uploaded to
// the public bucket. A phone photo is 3 to 12 MP and a few MB, while the
// shop never shows a product wider than ~1600px: what isn't uploaded never
// has to be downloaded again (by Vercel's image optimizer, by the app).
//
// Never used on payment proofs: those must reach the admin as sent.

export type CompressionTarget = {
  // Longest side, in pixels, after resizing. Smaller images keep their size.
  maxDimension: number;
  // Encoder quality, 0 to 1.
  quality: number;
};

// Clothes, shoes and their colors stay sharp on a retina product page.
// Measured on the shop's own 1500px PNG photos: 6.2 MB down to 1.2 MB (-81%);
// 0.85 saves a little more but visibly softens fabric texture at 100%.
export const PRODUCT_PHOTO: CompressionTarget = { maxDimension: 1600, quality: 0.9 };
// Full-width banner.
export const HERO_IMAGE: CompressionTarget = { maxDimension: 1920, quality: 0.82 };
// Shown at 32 to 64px, crisp up to 512px.
export const LOGO: CompressionTarget = { maxDimension: 512, quality: 0.9 };

const RASTER_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The file to upload: a resized WebP (where the browser can't encode WebP,
// JPEG, or PNG for an image with transparency), or the original whenever that is
// not smaller (already-optimized files, browsers that can't decode it, an
// encoder failure). Re-encoding also drops EXIF metadata, a phone's GPS
// position included.
export async function compressImage(file: File, target: CompressionTarget): Promise<File> {
  try {
    return await compress(file, target);
  } catch {
    // Compression is a saving, never a reason to fail an upload.
    return file;
  }
}

async function compress(file: File, target: CompressionTarget): Promise<File> {
  if (!RASTER_TYPES.includes(file.type) || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    // Applies the EXIF rotation, so a portrait phone photo stays upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, target.maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // A browser that can't encode WebP answers with a PNG instead: check what
  // came back.
  let encoded = await toBlob(canvas, "image/webp", target.quality);
  if (encoded?.type !== "image/webp") {
    // Transparency stays PNG (only resized); everything else becomes JPEG.
    encoded = hasTransparency(context, width, height)
      ? await toBlob(canvas, "image/png", target.quality)
      : await toBlob(canvas, "image/jpeg", target.quality);
  }

  if (!encoded || encoded.size >= file.size) return file;
  const extension = { "image/webp": "webp", "image/png": "png" }[encoded.type] ?? "jpg";
  const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.${extension}`;
  return new File([encoded], name, { type: encoded.type, lastModified: Date.now() });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// JPEG has no alpha channel: a product cut out on a transparent background
// would get a black one.
function hasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}
