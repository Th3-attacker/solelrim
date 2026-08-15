import { Button } from "@/components/ui/button";
import { getStoreHeroImageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

type HeroSettings = {
  heroImagePath: string | null;
  heroImagePosition: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBadgeText: string | null;
  heroCtaLabel: string | null;
};

// No photo uploaded yet: a typographic hero (giant watermark + theme-colored
// gradient) rather than an empty split panel — still uses the same
// badge/CTA config so it stays consistent once a photo is added later.
function HeroFallback({
  badgeText,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  badgeText: string | null;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-20 text-center sm:py-28">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[18vw] leading-none font-black whitespace-nowrap text-background/5 select-none"
      >
        SOLAL
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
        <Button asChild size="lg" className="mt-2">
          <a href={ctaHref}>{ctaLabel}</a>
        </Button>
      </div>
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

  const badgeText = settings.heroBadgeText;
  const title = settings.heroTitle || t("heroTitle");
  const subtitle = settings.heroSubtitle || t("heroSubtitle");
  const ctaLabel = settings.heroCtaLabel || t("heroCta");
  const ctaHref = `${basePath}/products`;

  if (!settings.heroImagePath) {
    return (
      <HeroFallback
        badgeText={badgeText}
        title={title}
        subtitle={subtitle}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
      />
    );
  }

  const imageOnLeft = settings.heroImagePosition === "left";

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
        <Button asChild size="lg" className="mt-1">
          <a href={ctaHref}>{ctaLabel}</a>
        </Button>
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
            src={getStoreHeroImageUrl(settings.heroImagePath)}
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
