"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice } from "@/lib/format/currency";
import { trackOrder, type TrackOrderResult } from "@/lib/actions/orders";
import { trackOrderSchema } from "@/lib/validation/order";
import type { z } from "zod";

type FormValues = z.input<typeof trackOrderSchema>;

export default function TrackOrderPage() {
  const t = useTranslations("trackOrder");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { storeType } = useParams<{ storeType: string }>();

  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { phone: "", reference: "", productType: storeType },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setSubmitting(true);
    setResult(null);
    const outcome = await trackOrder({ ...data, productType: storeType });
    setSubmitting(false);
    setResult(outcome);
  };

  const errorMessage =
    result && "error" in result
      ? result.error === "notFound"
        ? t("notFoundError")
        : result.error === "rateLimited"
          ? t("rateLimitedError")
          : t("validationError")
      : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-heading-md text-balance">{t("title")}</h1>
        <p className="text-paragraph-md text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                inputMode="numeric"
                maxLength={8}
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{tCommon("invalidPhone")}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reference">{t("referenceLabel")}</Label>
              <Input
                id="reference"
                placeholder={t("referencePlaceholder")}
                aria-invalid={!!errors.reference}
                {...register("reference")}
              />
              {errors.reference && (
                <p className="text-sm text-destructive">{tCommon("requiredField")}</p>
              )}
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              {t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {errorMessage && (
        <p className="text-center text-sm text-destructive">{errorMessage}</p>
      )}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{result.reference}</span>
              <OrderStatusBadge status={result.status} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("resultDate")}</span>
              <span>{format.dateTime(result.createdAt, { dateStyle: "medium" })}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground font-normal">{t("resultTotal")}</span>
              <span>{formatPrice(result.total, tCommon("currency"))}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
