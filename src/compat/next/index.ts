// Remplace le type du module "next" encore utilisé par lib/shop/metadata.ts
// et les loaders : la forme des métadonnées de page de Next.js, que
// lib/seo/head.ts traduit en balises <head> pour TanStack Router.

type OpenGraphImage = string | { url: string; width?: number; height?: number; alt?: string };

export type Metadata = {
  metadataBase?: URL;
  title?: string;
  description?: string;
  keywords?: string[];
  applicationName?: string;
  manifest?: string;
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
  openGraph?: {
    type?: string;
    locale?: string;
    url?: string;
    siteName?: string;
    title?: string;
    description?: string;
    images?: OpenGraphImage[];
  };
  twitter?: {
    card?: "summary" | "summary_large_image";
    title?: string;
    description?: string;
    images?: OpenGraphImage[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
    googleBot?: { index?: boolean; follow?: boolean };
  };
};
