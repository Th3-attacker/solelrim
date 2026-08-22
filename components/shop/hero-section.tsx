import { Button } from "@/components/ui/button";
import { getStoreHeroImageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { Package } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";

type HeroSettings = {
  heroImagePath: string | null;
  heroImagePosition: string;
  heroVariant: string;
  siteName: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBadgeText: string | null;
  heroCtaLabel: string | null;
};

type HeroContent = {
  imagePath: string | null;
  siteName: string;
  badgeText: string | null;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  trackOrderLabel: string;
  trackOrderHref: string;
};

// No photo uploaded yet: a typographic hero (giant watermark + theme-colored
// gradient) rather than an empty split panel — still uses the same
// badge/CTA config so it stays consistent once a photo is added later.
function HeroFallback({
  siteName,
  badgeText,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  trackOrderLabel,
  trackOrderHref,
}: Omit<HeroContent, "imagePath">) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-20 text-center sm:py-28">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[18vw] leading-none font-black whitespace-nowrap text-background/5 select-none"
      >
        {siteName}
      </span>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary)/35,transparent_60%)]"
      />
      <div className="animate-in fade-in slide-in-from-bottom-6 relative flex flex-col items-center gap-5 duration-1000">
        {badgeText && (
          <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {badgeText}
          </span>
        )}
        <h1 className="max-w-3xl text-heading-lg text-balance text-background sm:text-heading-2xl">
          {title}
        </h1>
        <p className="max-w-md text-paragraph-lg text-background/70 sm:text-paragraph-lg">
          {subtitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background">
            <a href={trackOrderHref}>
              <Package className="size-4" />
              {trackOrderLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// "split" (default) — the original layout: text on one side, a blob-shaped
// photo on the other, position configurable via heroImagePosition.
function HeroSplit({
  imagePath,
  badgeText,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  trackOrderLabel,
  trackOrderHref,
  imageOnLeft,
}: HeroContent & { imageOnLeft: boolean }) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
      <div
        className={cn(
          "flex flex-col items-start gap-5 animate-in fade-in slide-in-from-bottom-6 duration-1000",
          imageOnLeft ? "md:order-2" : "md:order-1",
        )}
      >
        {badgeText && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {badgeText}
          </span>
        )}
        <h1 className="max-w-3xl text-heading-lg text-balance sm:text-heading-2xl">
          {title}
        </h1>
        <p className="max-w-sm text-paragraph-lg  text-muted-foreground sm:text-paragraph-xl">
          {subtitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={trackOrderHref}>
              <Package className="size-4" />
              {trackOrderLabel}
            </a>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative mx-auto aspect-square w-full max-w-sm sm:max-w-md",
          imageOnLeft ? "md:order-1" : "md:order-2",
        )}
      >
        <div
          aria-hidden
          className="absolute -top-6 -start-6 size-28 rounded-full bg-primary/15 sm:size-36"
        />
        <div
          aria-hidden
          className="absolute -end-4 -bottom-8 size-36 rounded-full bg-primary/25 sm:size-44"
        />
        <div className="relative size-full overflow-hidden rounded-[60%_40%_30%_70%/60%_30%_70%_40%] shadow-sm ">
          <Image
            src={getStoreHeroImageUrl(imagePath!)}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
          />
        </div>
      </div>
    </div>
  );
}

// "fullbleed" — a poster-style banner: the photo fills the whole width with
// a dark gradient for legibility, content centered on top. With no photo it
// falls back to the same watermark/gradient treatment as HeroFallback
// instead of a distinct empty state, so the layout never has a "half done"
// look while an admin is still filling in the photo.
function HeroFullbleed({
  imagePath,
  siteName,
  badgeText,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  trackOrderLabel,
  trackOrderHref,
}: HeroContent) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-foreground px-6 py-24 text-center sm:py-32">
      {imagePath ? (
        <>
          <Image
            src={getStoreHeroImageUrl(imagePath)}
            alt=""
            fill
            className="absolute inset-0 -z-20 object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-foreground via-foreground/70 to-foreground/20" />
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[18vw] leading-none font-black whitespace-nowrap text-background/5 select-none"
          >
            {siteName}
          </span>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary)/35,transparent_60%)]"
          />
        </>
      )}
      <div className="animate-in fade-in slide-in-from-bottom-6 relative flex flex-col items-center gap-5 duration-1000">
        {badgeText && (
          <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {badgeText}
          </span>
        )}
        <h1 className="max-w-3xl text-heading-lg text-balance text-background sm:text-heading-2xl">
          {title}
        </h1>
        <p className="max-w-md text-paragraph-lg text-background/70 sm:text-paragraph-lg">
          {subtitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background">
            <a href={trackOrderHref}>
              <Package className="size-4" />
              {trackOrderLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// "minimal" — a compact banner: no decorative shapes, text always
// left-aligned, photo (if any) shown as a small thumbnail rather than a big
// showpiece. For boutiques that want something lighter/faster than the
// other two.
function HeroMinimal({
  imagePath,
  badgeText,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  trackOrderLabel,
  trackOrderHref,
}: HeroContent) {
  return (
    <div className="flex flex-col items-start gap-6 border-b pb-10 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col items-start gap-3 duration-700">
        {badgeText && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {badgeText}
          </span>
        )}
        <h1 className="max-w-lg text-heading-md text-balance sm:text-heading-lg">
          {title}
        </h1>
        <p className="max-w-sm text-paragraph-md text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={trackOrderHref}>
              <Package className="size-4" />
              {trackOrderLabel}
            </a>
          </Button>
        </div>
      </div>

      {imagePath && (
        <div className="relative aspect-square w-full max-w-45 shrink-0 overflow-hidden rounded-xl sm:max-w-55">
          <Image
            src={getStoreHeroImageUrl(imagePath)}
            alt=""
            fill
            className="object-cover"
            sizes="220px"
            priority
          />
        </div>
      )}
    </div>
  );
}

export async function HeroSection({
  settings,
  basePath,
}: {
  settings: HeroSettings;
  basePath: string;
}) {
  const t = await getTranslations("shop");

  const content: HeroContent = {
    imagePath: settings.heroImagePath,
    siteName: settings.siteName?.trim() || t("siteName"),
    badgeText: settings.heroBadgeText,
    title: settings.heroTitle || t("heroTitle"),
    subtitle: settings.heroSubtitle || t("heroSubtitle"),
    ctaLabel: settings.heroCtaLabel || t("heroCta"),
    ctaHref: `${basePath}/products`,
    trackOrderLabel: t("trackOrderLink"),
    trackOrderHref: `${basePath}/track-order`,
  };

  if (settings.heroVariant === "fullbleed") {
    return <HeroFullbleed {...content} />;
  }

  if (settings.heroVariant === "minimal") {
    return <HeroMinimal {...content} />;
  }

  if (!content.imagePath) {
    return <HeroFallback {...content} />;
  }

  return (
    <HeroSplit {...content} imageOnLeft={settings.heroImagePosition === "left"} />
  );
}
