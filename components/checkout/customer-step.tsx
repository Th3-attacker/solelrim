"use client";

import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/status-alert";
import type { CheckoutCustomerInput } from "@/lib/validation/order";

// Step 1: who orders. The form state lives in CheckoutFlow, which restores it
// when a checkout is resumed.
export function CustomerStep({
  form: {
    register,
    handleSubmit,
    formState: { errors },
  },
  onSubmit,
}: {
  form: UseFormReturn<CheckoutCustomerInput>;
  onSubmit: (data: CheckoutCustomerInput) => void;
}) {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");

  function fieldErrorMessage(message?: string) {
    if (message === "required") return tCommon("requiredField");
    if (message === "invalidPhone") return tCommon("invalidPhone");
    return t("validationError");
  }

  return (
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <h1 className="text-heading-xs">{t("step1Title")}</h1>
          <p className="text-sm text-muted-foreground">{t("step1Hint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="customerName">{t("customerName")}</Label>
            <Input
              id="customerName"
              autoComplete="name"
              aria-invalid={!!errors.customerName}
              aria-describedby={errors.customerName ? "customerName-error" : undefined}
              {...register("customerName")}
            />
            {errors.customerName && (
              <FieldError id="customerName-error">
                {fieldErrorMessage(errors.customerName.message)}
              </FieldError>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerPhone">{t("customerPhone")}</Label>
            <Input
              id="customerPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={8}
              aria-invalid={!!errors.customerPhone}
              aria-describedby={errors.customerPhone ? "customerPhone-error" : undefined}
              {...register("customerPhone")}
            />
            {errors.customerPhone && (
              <FieldError id="customerPhone-error">
                {fieldErrorMessage(errors.customerPhone.message)}
              </FieldError>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerCity">{t("customerCity")}</Label>
            <Input
              id="customerCity"
              autoComplete="address-level2"
              aria-invalid={!!errors.customerCity}
              aria-describedby={errors.customerCity ? "customerCity-error" : undefined}
              {...register("customerCity")}
            />
            {errors.customerCity && (
              <FieldError id="customerCity-error">
                {fieldErrorMessage(errors.customerCity.message)}
              </FieldError>
            )}
          </div>
        </div>
        <Button type="submit" size="lg" className="self-start">
          {t("next")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      </form>
  );
}
