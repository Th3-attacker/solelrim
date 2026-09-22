"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { promoCodeSchema, type PromoCodeInput } from "@/lib/validation/promo-code";
import { createPromoCode, updatePromoCode } from "@/lib/actions/promo-codes";

const GENERAL_CODE_VALUE = "__general__";

type Client = { id: string; fullName: string };
type PromoCodeFormValues = z.input<typeof promoCodeSchema>;
type ExistingPromoCode = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  clientId: string | null;
  expiresAt: string | null;
  maxUses: number | null;
};

export function PromoCodeFormDialog({
  clients = [],
  fixedClient,
  promoCode,
  trigger,
}: {
  clients?: Client[];
  fixedClient?: Client;
  promoCode?: ExistingPromoCode;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("promoCodes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultValues: PromoCodeFormValues = promoCode
    ? {
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        clientId: promoCode.clientId,
        expiresAt: promoCode.expiresAt,
        maxUses: promoCode.maxUses,
      }
    : {
        code: "",
        discountType: "PERCENT",
        discountValue: 10,
        clientId: fixedClient?.id ?? null,
        expiresAt: null,
        maxUses: null,
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PromoCodeFormValues, unknown, PromoCodeInput>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues,
  });

  function fieldErrorMessage(message?: string) {
    if (message === "invalidCode") return t("invalidCodeError");
    if (message === "invalidPercent") return t("invalidPercentError");
    return tCommon("requiredField");
  }

  const onSubmit: SubmitHandler<PromoCodeInput> = async (data) => {
    setSubmitting(true);
    const result = promoCode
      ? await updatePromoCode(promoCode.id, data)
      : await createPromoCode(data);
    setSubmitting(false);

    if (result.error) {
      if (result.error === "duplicateCode") {
        toast.error(t("duplicateCodeError"));
      } else if (result.error === "featureDisabled") {
        toast.error(t("featureDisabledError"));
      } else {
        toast.error(tCommon("error"));
      }
      return;
    }

    if (!promoCode) reset();
    setOpen(false);
    router.refresh();
    toast.success(tCommon("save"));
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset(defaultValues);
        setOpen(next);
      }}
      trigger={trigger}
      title={promoCode ? t("editCode") : t("newCode")}
      footer={
        <Button type="button" loading={submitting} onClick={handleSubmit(onSubmit)}>
          {promoCode ? tCommon("save") : tCommon("create")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">{t("code")}</Label>
          <Input
            id="code"
            placeholder="WELCOME10"
            aria-invalid={!!errors.code}
            {...register("code")}
          />
          {errors.code && (
            <p className="text-sm text-destructive">
              {fieldErrorMessage(errors.code.message)}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="discountType">{t("discountType")}</Label>
            <Select
              value={watch("discountType")}
              onValueChange={(value) =>
                setValue("discountType", value as "PERCENT" | "FIXED")
              }
            >
              <SelectTrigger id="discountType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">{t("percent")}</SelectItem>
                <SelectItem value="FIXED">{t("fixed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="discountValue">{t("discountValue")}</Label>
            <Input
              id="discountValue"
              type="number"
              step="0.01"
              aria-invalid={!!errors.discountValue}
              {...register("discountValue")}
            />
            {errors.discountValue && (
              <p className="text-sm text-destructive">
                {fieldErrorMessage(errors.discountValue.message)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("client")}</Label>
          {fixedClient ? (
            <p className="text-sm text-muted-foreground">{fixedClient.fullName}</p>
          ) : (
            <Select
              value={(watch("clientId") as string | null) ?? GENERAL_CODE_VALUE}
              onValueChange={(value) =>
                setValue("clientId", value === GENERAL_CODE_VALUE ? null : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_CODE_VALUE}>{t("generalCode")}</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expiresAt">{t("expiresAt")}</Label>
            <Input
              id="expiresAt"
              type="date"
              value={watch("expiresAt") ?? ""}
              onChange={(e) => setValue("expiresAt", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxUses">{t("maxUses")}</Label>
            <Input
              id="maxUses"
              type="number"
              min="1"
              placeholder={t("unlimited")}
              value={(watch("maxUses") as number | null) ?? ""}
              onChange={(e) =>
                setValue("maxUses", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
