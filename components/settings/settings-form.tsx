"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import { updateStoreSettings } from "@/lib/actions/settings";

export function SettingsForm({
  defaultValues,
}: {
  defaultValues: SettingsInput;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const onSubmit: SubmitHandler<SettingsInput> = async (data) => {
    setSubmitting(true);
    const result = await updateStoreSettings(data);
    setSubmitting(false);

    if (result.error) {
      toast.error(tCommon("error"));
      return;
    }

    toast.success(tCommon("save"));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bankilyNumber">{t("bankilyNumber")}</Label>
            <Input id="bankilyNumber" {...register("bankilyNumber")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="masrivyNumber">{t("masrivyNumber")}</Label>
            <Input id="masrivyNumber" {...register("masrivyNumber")} />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="adminWhatsappNumber">
              {t("adminWhatsappNumber")}
            </Label>
            <Input
              id="adminWhatsappNumber"
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
          <CardTitle className="text-base">{t("brandingSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="siteName">{t("siteName")}</Label>
            <Input id="siteName" {...register("siteName")} />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="announcementText">{t("announcementText")}</Label>
            <Input id="announcementText" {...register("announcementText")} />
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
            <Input id="seoTitle" {...register("seoTitle")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seoDescription">{t("seoDescription")}</Label>
            <Input id="seoDescription" {...register("seoDescription")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("socialSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagramUrl">{t("instagramUrl")}</Label>
            <Input id="instagramUrl" {...register("instagramUrl")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="facebookUrl">{t("facebookUrl")}</Label>
            <Input id="facebookUrl" {...register("facebookUrl")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktokUrl">{t("tiktokUrl")}</Label>
            <Input id="tiktokUrl" {...register("tiktokUrl")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
