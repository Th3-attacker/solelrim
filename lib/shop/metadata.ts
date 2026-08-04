import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/shop/site-url";

// Shared Open Graph + Twitter card shape for every public storefront page —
// keeps social/WhatsApp link previews consistent without repeating the same
// object literal at every generateMetadata() call site. Also re-asserts
// metadataBase here (already set on the root [locale]/layout.tsx) — Next
// warns and falls back to localhost when resolving the file-convention
// opengraph-image.tsx's relative URL if it doesn't find metadataBase on the
// exact metadata object being resolved for a given route.
export function buildSocialMetadata({
  title,
  description,
  imageUrl,
  locale,
}: {
  title: string;
  description: string;
  imageUrl?: string | null;
  locale: string;
}): Pick<Metadata, "metadataBase" | "openGraph" | "twitter"> {
  // Omitted entirely (not even as an explicit `undefined` key) when there's
  // no boutique/product photo to use, so Next falls through to the nearest
  // file-convention opengraph-image.tsx instead of rendering no image.
  const images = imageUrl ? [{ url: imageUrl }] : undefined;

  return {
    metadataBase: new URL(getSiteUrl()),
    openGraph: {
      title,
      description,
      locale,
      type: "website",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}
