import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function HeroSection() {
  const t = await getTranslations("shop");

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("heroTitle")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("heroSubtitle")}</p>
      <Button asChild size="lg">
        <a href="#catalog">{t("heroCta")}</a>
      </Button>
    </div>
  );
}
