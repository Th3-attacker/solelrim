"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCardVariant, setFooterVariant, setHeroVariant } from "@/lib/actions/settings";

export function LayoutVariantsPicker({
  heroVariant,
  cardVariant,
  footerVariant,
}: {
  heroVariant: string;
  cardVariant: string;
  footerVariant: string;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function handleHeroChange(value: string) {
    startTransition(async () => {
      const result = await setHeroVariant(value);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleCardChange(value: string) {
    startTransition(async () => {
      const result = await setCardVariant(value);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleFooterChange(value: string) {
    startTransition(async () => {
      const result = await setFooterVariant(value);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-sm font-medium">{t("layoutVariantsSection")}</span>
        <p className="text-sm text-muted-foreground">{t("layoutVariantsSectionHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t("heroVariant")}</span>
          <Select value={heroVariant} disabled={pending} onValueChange={handleHeroChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="split">{t("heroVariantSplit")}</SelectItem>
              <SelectItem value="fullbleed">{t("heroVariantFullbleed")}</SelectItem>
              <SelectItem value="minimal">{t("heroVariantMinimal")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t("cardVariant")}</span>
          <Select value={cardVariant} disabled={pending} onValueChange={handleCardChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t("cardVariantDefault")}</SelectItem>
              <SelectItem value="bordered">{t("cardVariantBordered")}</SelectItem>
              <SelectItem value="cart">{t("cardVariantCart")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t("footerVariant")}</span>
          <Select value={footerVariant} disabled={pending} onValueChange={handleFooterChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="columns">{t("footerVariantColumns")}</SelectItem>
              <SelectItem value="minimal">{t("footerVariantMinimal")}</SelectItem>
              <SelectItem value="centered">{t("footerVariantCentered")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
