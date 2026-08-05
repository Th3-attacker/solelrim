"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  boutiqueSettingsSchema,
  type BoutiqueSettingsInput,
} from "@/lib/validation/settings";
import { updateBoutiqueSettings } from "@/lib/actions/settings";

export function BoutiqueSettingsForm({
  defaultValues,
}: {
  defaultValues: BoutiqueSettingsInput;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tLanguage = useTranslations("language");
  const [submitting, setSubmitting] = useState(false);
  const [contentLang, setContentLang] = useState<"fr" | "ar">("fr");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BoutiqueSettingsInput>({
    resolver: zodResolver(boutiqueSettingsSchema),
    defaultValues,
  });

  const onSubmit: SubmitHandler<BoutiqueSettingsInput> = async (data) => {
    setSubmitting(true);
    const result = await updateBoutiqueSettings(data);
    setSubmitting(false);

    if (result.error) {
      toast.error(tCommon("error"));
      return;
    }

    toast.success(tCommon("save"));
  };

  const rtl = contentLang === "ar";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t("contentLanguage")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("contentLanguageHint")}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={contentLang}
            onValueChange={(value) => value && setContentLang(value as "fr" | "ar")}
          >
            <ToggleGroupItem value="fr">{tLanguage("fr")}</ToggleGroupItem>
            <ToggleGroupItem value="ar">{tLanguage("ar")}</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("brandingSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="siteName">{t("siteName")}</Label>
            {rtl ? (
              <Input id="siteName" dir="rtl" lang="ar" {...register("siteNameAr")} />
            ) : (
              <Input id="siteName" {...register("siteName")} />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="announcementText">{t("announcementText")}</Label>
            <Input id="announcementText" {...register("announcementText")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="adminWhatsappNumber">
              {t("adminWhatsappNumber")}
            </Label>
            <Input
              id="adminWhatsappNumber"
              aria-invalid={!!errors.adminWhatsappNumber}
              {...register("adminWhatsappNumber")}
            />
            {errors.adminWhatsappNumber && (
              <p className="text-sm text-destructive">
                {tCommon("requiredField")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="paymentInstructions">
              {t("paymentInstructions")}
            </Label>
            <Textarea
              id="paymentInstructions"
              {...register("paymentInstructions")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("heroSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="heroBadgeText">{t("heroBadgeText")}</Label>
            <Input
              id="heroBadgeText"
              placeholder={t("heroBadgeTextPlaceholder")}
              {...register("heroBadgeText")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="heroImagePosition">{t("heroImagePosition")}</Label>
            <Select
              value={watch("heroImagePosition") ?? "right"}
              onValueChange={(value) =>
                setValue("heroImagePosition", value as "left" | "right")
              }
            >
              <SelectTrigger id="heroImagePosition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">
                  {t("heroImagePositionRight")}
                </SelectItem>
                <SelectItem value="left">
                  {t("heroImagePositionLeft")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="heroTitle">{t("heroTitle")}</Label>
            {rtl ? (
              <Input id="heroTitle" dir="rtl" lang="ar" {...register("heroTitleAr")} />
            ) : (
              <Input id="heroTitle" {...register("heroTitle")} />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="heroSubtitle">{t("heroSubtitle")}</Label>
            {rtl ? (
              <Input id="heroSubtitle" dir="rtl" lang="ar" {...register("heroSubtitleAr")} />
            ) : (
              <Input id="heroSubtitle" {...register("heroSubtitle")} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="heroCtaLabel">{t("heroCtaLabel")}</Label>
            <Input
              id="heroCtaLabel"
              placeholder={t("heroCtaLabelPlaceholder")}
              {...register("heroCtaLabel")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("seoSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="seoTitle">{t("seoTitle")}</Label>
            {rtl ? (
              <Input id="seoTitle" dir="rtl" lang="ar" {...register("seoTitleAr")} />
            ) : (
              <Input id="seoTitle" {...register("seoTitle")} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seoDescription">{t("seoDescription")}</Label>
            {rtl ? (
              <Input id="seoDescription" dir="rtl" lang="ar" {...register("seoDescriptionAr")} />
            ) : (
              <Input id="seoDescription" {...register("seoDescription")} />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={submitting}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
