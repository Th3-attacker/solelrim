import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function HeroSection() {
  const t = await getTranslations("shop");

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-muted/60 via-background to-primary/10 px-6 py-20 text-center sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_start,var(--color-primary)/12,transparent_55%)]"
      />
      <div className="relative flex flex-col items-center gap-5">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
          {t("siteName")}
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="max-w-md text-muted-foreground sm:text-lg">
          {t("heroSubtitle")}
        </p>
        <Button asChild size="lg" className="mt-2 h-12 px-8 text-base shadow-lg shadow-primary/20">
          <a href="#catalog">{t("heroCta")}</a>
        </Button>
      </div>
    </div>
  );
}
