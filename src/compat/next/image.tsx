import type { CSSProperties, ImgHTMLAttributes } from "react";
import { DEVICE_SIZES, IMAGE_SIZES, optimizedImageUrl } from "@/lib/image-config";

// Remplace next/image par une <img> standard : mêmes props (fill, sizes,
// priority…), même rendu, et, une fois déployé sur Vercel, les mêmes copies
// redimensionnées par l'optimiseur d'images de Vercel (vite.config.ts).

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: string;
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
};

const ALL_WIDTHS = [...IMAGE_SIZES, ...DEVICE_SIZES].sort((a, b) => a - b);

function srcSetFor(src: string, width: number | undefined, sizes: string | undefined) {
  // Avec `sizes`, toutes les largeurs (descripteurs "w") ; avec une largeur
  // fixe, la copie 1x et la 2x (descripteurs "x") — comme next/image.
  if (sizes || !width) {
    return ALL_WIDTHS.map((w) => `${optimizedImageUrl(src, w)} ${w}w`).join(", ");
  }
  const pick = (target: number) => ALL_WIDTHS.find((w) => w >= target) ?? ALL_WIDTHS.at(-1)!;
  return [1, 2]
    .map((density) => `${optimizedImageUrl(src, pick(width * density))} ${density}x`)
    .join(", ");
}

const FILL_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  priority,
  quality: _quality,
  unoptimized,
  sizes,
  style,
  loading,
  ...rest
}: ImageProps) {
  const numericWidth = width === undefined ? undefined : Number(width);
  const optimizable = __VERCEL_IMAGES__ && !unoptimized && !/^(blob|data):/.test(src);
  const resolvedSizes = sizes ?? (fill ? "100vw" : undefined);

  return (
    <img
      {...rest}
      alt={alt}
      src={optimizable ? optimizedImageUrl(src, ALL_WIDTHS.at(-1)!) : src}
      srcSet={optimizable ? srcSetFor(src, numericWidth, resolvedSizes) : undefined}
      sizes={optimizable ? resolvedSizes : undefined}
      width={fill ? undefined : numericWidth}
      height={fill ? undefined : height === undefined ? undefined : Number(height)}
      loading={priority ? "eager" : (loading ?? "lazy")}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={{ color: "transparent", ...(fill ? FILL_STYLE : null), ...style }}
    />
  );
}
