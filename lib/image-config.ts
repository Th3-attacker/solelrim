// The widths next/image may ask Vercel's optimizer for (vite.config.ts). Each
// width an image is shown at is a separate optimized copy, and every copy
// that isn't cached yet makes Vercel download the original from Supabase
// Storage, which is what counts against Supabase's Cached Egress. Fewer
// widths, fewer downloads; these still cover phones (2x and 3x screens),
// tablets and desktops.
export const DEVICE_SIZES = [640, 828, 1080, 1200, 1920] as const;
export const IMAGE_SIZES = [64, 128, 256, 384] as const;

// How long an optimized copy is kept before Vercel fetches the original again
// (default: 4 hours). Every image in the public bucket is written once at a
// fresh path and never overwritten, so a month is safe.
export const OPTIMIZED_IMAGE_TTL_SECONDS = 31 * 24 * 60 * 60;

// Cache-Control of the objects uploaded to the public bucket (Supabase's
// default is one hour): browsers and Supabase's CDN can keep them a year,
// since a replaced photo, logo or hero image always gets a new path.
export const PUBLIC_IMAGE_CACHE_CONTROL = String(365 * 24 * 60 * 60);

export type OptimizedWidth = (typeof DEVICE_SIZES)[number] | (typeof IMAGE_SIZES)[number];

// L'URL de l'optimiseur d'images de Vercel (/_vercel/image, configuré dans
// vite.config.ts) pour une image publique et une largeur donnée. Utilisée par
// le remplaçant de next/image (src/compat/next/image.tsx).
export function optimizedImageUrl(src: string, width: number): string {
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

// The optimizer's URL for a public image, for places next/image can't render:
// social previews (og:image) and structured data. Relative: metadata resolves
// it against metadataBase. Hors de Vercel (pnpm dev), il n'y a pas
// d'optimiseur : l'image d'origine.
export function optimizedImagePath(src: string, width: OptimizedWidth): string {
  return process.env.VERCEL ? optimizedImageUrl(src, width) : src;
}

// La configuration de l'optimiseur de Vercel (vite.config.ts, sortie de build
// Vercel) : ex-`images` de next.config.ts — mêmes largeurs, même durée de
// cache, limité au stockage public de Supabase. Les motifs sont des
// expressions régulières, comme celles que Next.js écrivait lui-même.
export function vercelImagesConfig() {
  return {
    domains: [],
    sizes: [...DEVICE_SIZES, ...IMAGE_SIZES].sort((a, b) => a - b),
    minimumCacheTTL: OPTIMIZED_IMAGE_TTL_SECONDS,
    formats: ["image/webp" as const],
    remotePatterns: [
      {
        protocol: "https" as const,
        hostname: "^(.+\\.)?supabase\\.co$",
        pathname: "^/storage/v1/object/public/.*$",
      },
    ],
  };
}
