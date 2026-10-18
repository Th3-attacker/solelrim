import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/shop/site-url";

// Les métadonnées de page (même forme que celles de Next.js, voir
// src/compat/next/index.ts) traduites en balises <head> pour TanStack Router.
//
// Chaque loader renvoie les métadonnées de son niveau, déjà résolues côté
// serveur (resolveMetadata : URL absolues). La route racine les fusionne
// ensuite, du parent vers l'enfant, comme Next.js fusionnait les
// generateMetadata imbriqués (une clé redéfinie par l'enfant remplace celle
// du parent), puis produit les balises (src/routes/__root.tsx).

export type ResolvedMetadata = Omit<Metadata, "metadataBase">;

type MetaTag = Record<string, string>;
type LinkTag = Record<string, string>;

// URL relatives → absolues, par rapport à metadataBase (sinon le domaine du
// site) : le navigateur n'a pas accès aux variables d'environnement
// serveur qui déterminent ce domaine.
export function resolveMetadata(metadata: Metadata): ResolvedMetadata {
  const { metadataBase, ...rest } = metadata;
  const base = metadataBase ?? new URL(getSiteUrl());
  const absolute = (url: string) => new URL(url, base).toString();
  const images = (list?: NonNullable<Metadata["openGraph"]>["images"]) =>
    list?.map((image) =>
      typeof image === "string" ? absolute(image) : { ...image, url: absolute(image.url) },
    );

  return {
    ...rest,
    ...(rest.alternates && {
      alternates: {
        ...(rest.alternates.canonical && { canonical: absolute(rest.alternates.canonical) }),
        ...(rest.alternates.languages && {
          languages: Object.fromEntries(
            Object.entries(rest.alternates.languages).map(([lang, url]) => [lang, absolute(url)]),
          ),
        }),
      },
    }),
    ...(rest.openGraph && {
      openGraph: {
        ...rest.openGraph,
        ...(rest.openGraph.url && { url: absolute(rest.openGraph.url) }),
        ...(rest.openGraph.images && { images: images(rest.openGraph.images) }),
      },
    }),
    ...(rest.twitter && {
      twitter: {
        ...rest.twitter,
        ...(rest.twitter.images && { images: images(rest.twitter.images) }),
      },
    }),
  };
}

export function mergeMetadata(levels: (ResolvedMetadata | undefined)[]): ResolvedMetadata {
  return Object.assign({}, ...levels.filter(Boolean));
}

function robotsContent(robots: { index?: boolean; follow?: boolean }): string {
  return [
    robots.index === false ? "noindex" : "index",
    robots.follow === false ? "nofollow" : "follow",
  ].join(", ");
}

function imageUrls(list?: NonNullable<Metadata["openGraph"]>["images"]): string[] {
  return list?.map((image) => (typeof image === "string" ? image : image.url)) ?? [];
}

export function metadataToHead(metadata: ResolvedMetadata): { meta: MetaTag[]; links: LinkTag[] } {
  const meta: MetaTag[] = [];
  const links: LinkTag[] = [];
  const named = (name: string, content?: string) => content && meta.push({ name, content });
  const property = (key: string, content?: string) =>
    content && meta.push({ property: key, content });

  if (metadata.title) meta.push({ title: metadata.title });
  named("description", metadata.description);
  named("application-name", metadata.applicationName);
  named("keywords", metadata.keywords?.join(","));
  if (metadata.robots) {
    named("robots", robotsContent(metadata.robots));
    if (metadata.robots.googleBot) named("googlebot", robotsContent(metadata.robots.googleBot));
  }

  if (metadata.alternates?.canonical) {
    links.push({ rel: "canonical", href: metadata.alternates.canonical });
  }
  for (const [hrefLang, href] of Object.entries(metadata.alternates?.languages ?? {})) {
    links.push({ rel: "alternate", hrefLang, href });
  }
  if (metadata.manifest) links.push({ rel: "manifest", href: metadata.manifest });

  const og = metadata.openGraph;
  if (og) {
    property("og:title", og.title);
    property("og:description", og.description);
    property("og:url", og.url);
    property("og:site_name", og.siteName);
    property("og:locale", og.locale);
    for (const url of imageUrls(og.images)) property("og:image", url);
    property("og:type", og.type);
  }

  const twitter = metadata.twitter;
  if (twitter) {
    named("twitter:card", twitter.card);
    named("twitter:title", twitter.title);
    named("twitter:description", twitter.description);
    for (const url of imageUrls(twitter.images)) named("twitter:image", url);
  }

  return { meta, links };
}
