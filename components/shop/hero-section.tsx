import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function HeroSection() {
  const t = await getTranslations("shop");

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
        <h1 className="max-w-2xl text-4xl font-black tracking-tight text-balance text-white sm:text-6xl">
          {t("heroTitle")}
        </h1>
        <p className="max-w-md text-white/70 sm:text-lg">
          {t("heroSubtitle")}
        </p>
        <Button
          asChild
          size="lg"
          className="mt-2 h-12 px-8 text-base shadow-lg shadow-primary/30"
        >
          <a href="#catalog">{t("heroCta")}</a>
        </Button>
      </div>
    </div>
  );
}
