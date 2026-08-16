"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice } from "@/lib/format/currency";
import { trackOrder, type TrackOrderResult } from "@/lib/actions/orders";
import { trackOrderSchema } from "@/lib/validation/order";
import { buildWhatsAppLink } from "@/lib/shop/contact";
import type { z } from "zod";

type FormValues = z.input<typeof trackOrderSchema>;

// Statuses where nothing more is coming — no point offering a "still
// waiting?" nudge once the order is already closed out.
const TERMINAL_STATUSES = new Set(["DELIVERED", "REJECTED", "CANCELLED"]);
const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Kept outside the component on purpose: the React Compiler's purity rule
// forbids calling an impure API like Date.now() anywhere in a component's
// body, including inside a closure such as onSubmit. A plain module-level
// function sidesteps that — it's only ever invoked from the event handler,
// never during render.
function getStuckWhatsAppHref(
  outcome: TrackOrderResult,
  adminWhatsappNumber: string | null,
): string | null {
  if (
    "error" in outcome ||
    !adminWhatsappNumber ||
    TERMINAL_STATUSES.has(outcome.status) ||
    Date.now() - new Date(outcome.statusSince).getTime() <= STUCK_THRESHOLD_MS
  ) {
    return null;
  }
  // Pre-filled message body is deliberately hardcoded French, not run
  // through next-intl — same rationale as lib/shop/whatsapp.ts and
  // lib/shop/contact.ts: it's addressed to the store's French-speaking
  // admin regardless of the customer's browsing locale.
  return buildWhatsAppLink(
    adminWhatsappNumber,
    `Bonjour, je n'ai pas de nouvelles de ma commande ${outcome.reference} depuis un moment, pouvez-vous vérifier ?`,
  );
}

export function TrackOrderForm({
  adminWhatsappNumber,
}: {
  adminWhatsappNumber: string | null;
}) {
  const t = useTranslations("trackOrder");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { storeType } = useParams<{ storeType: string }>();

  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Computed once when the result arrives, not derived during render —
  // Date.now() is an impure call the React Compiler won't allow in render.
  const [stuckWhatsAppHref, setStuckWhatsAppHref] = useState<string | null>(null);

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
    setStuckWhatsAppHref(null);
    const outcome = await trackOrder({ ...data, productType: storeType });
    setSubmitting(false);
    setResult(outcome);
    setStuckWhatsAppHref(getStuckWhatsAppHref(outcome, adminWhatsappNumber));
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
            {stuckWhatsAppHref && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <p className="text-sm text-muted-foreground">{t("stuckNotice")}</p>
                <Button asChild variant="outline" size="sm">
                  <a href={stuckWhatsAppHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" />
                    {t("stuckCta")}
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
