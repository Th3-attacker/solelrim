import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getStoreHeroImageUrl } from "@/lib/supabase/storage";

type HeroSettings = {
  heroImagePath: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
};

export async function HeroSection({ settings }: { settings: HeroSettings }) {
  const t = await getTranslations("shop");

  if (!settings.heroImagePath) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-20 text-center sm:py-28">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[18vw] leading-none font-black whitespace-nowrap text-white/5 select-none"
        >
          SOLELRIM
        </span>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary)/35,transparent_60%)]"
        />
        <div className="animate-in fade-in slide-in-from-bottom-6 relative flex flex-col items-center gap-5 duration-1000">
          <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium tracking-widest text-primary uppercase">
            {t("siteName")}
          </span>
          <h1 className="max-w-2xl text-heading-lg text-balance text-white sm:text-heading-xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-md text-paragraph-md text-white/70 sm:text-paragraph-lg">
            {t("heroSubtitle")}
          </p>
          <Button asChild size="lg" className="mt-2">
            <a href="#catalog">{t("heroCta")}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-110 overflow-hidden rounded-3xl bg-muted">
      <Image
        src={getStoreHeroImageUrl(settings.heroImagePath)}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
      />
      <div className="relative flex min-h-110 flex-col justify-end gap-4 p-8 md:p-12">
        {settings.heroTitle && (
          <h1 className="max-w-2xl text-heading-lg text-balance text-white sm:text-heading-xl">
            {settings.heroTitle}
          </h1>
        )}
        {settings.heroSubtitle && (
          <p className="max-w-md text-paragraph-md text-white/80 sm:text-paragraph-lg">
            {settings.heroSubtitle}
          </p>
        )}
        <div>
          <Button asChild size="lg" className="mt-2">
            <a href="#catalog">{t("heroCta")}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
