"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/components/cart/cart-provider";
import { submitOrder } from "@/lib/actions/orders";
import { buildOrderWhatsAppLink } from "@/lib/shop/whatsapp";
import { formatPrice } from "@/lib/format/currency";
import {
  checkoutCustomerSchema,
  type CheckoutCustomerInput,
} from "@/lib/validation/order";

type Settings = {
  bankilyNumber: string | null;
  masrivyNumber: string | null;
  adminWhatsappNumber: string | null;
  paymentInstructions: string | null;
};

type Step = 1 | 2 | 3 | "success";

export function CheckoutFlow({
  settings,
  open,
  onClose,
}: {
  settings: Settings;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const cart = useCart();

  const [step, setStep] = useState<Step>(1);
  const [customerInfo, setCustomerInfo] = useState<CheckoutCustomerInput | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Snapshot the cart at submission time — clear() empties the live cart
  // right after success, so the WhatsApp button needs its own copy.
  const orderSnapshotRef = useRef<{
    items: typeof cart.items;
    total: number;
    customer: CheckoutCustomerInput;
  } | null>(null);

  // The drawer stays mounted across opens, so a fresh order after a
  // previous success shouldn't reopen straight onto the success screen.
  useEffect(() => {
    if (open && step === "success") {
      setStep(1);
      setCustomerInfo(null);
      setFile(null);
      setReference(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && cart.hydrated && cart.items.length === 0 && step !== "success") {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cart.hydrated, cart.items.length, step]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutCustomerInput>({
    resolver: zodResolver(checkoutCustomerSchema),
    defaultValues: { customerName: "", customerPhone: "", customerCity: "" },
  });

  const onSubmitStep1: SubmitHandler<CheckoutCustomerInput> = (data) => {
    setCustomerInfo(data);
    setStep(2);
  };

  async function handleFinalSubmit() {
    if (!customerInfo || !file) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set("customerName", customerInfo.customerName);
    formData.set("customerPhone", customerInfo.customerPhone);
    formData.set("customerCity", customerInfo.customerCity);
    formData.set("locale", locale);
    formData.set(
      "items",
      JSON.stringify(
        cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    );
    formData.set("screenshot", file);

    const result = await submitOrder(formData);
    setSubmitting(false);

    if (result.error || !result.reference) {
      toast.error(
        result.error === "insufficientStock"
          ? t("insufficientStockError")
          : result.error === "rateLimited"
            ? t("rateLimitedError")
            : t("validationError"),
      );
      return;
    }

    orderSnapshotRef.current = {
      items: cart.items,
      total: cart.subtotal,
      customer: customerInfo,
    };
    setReference(result.reference);
    cart.clear();
    setStep("success");
  }

  function handleSendWhatsApp() {
    if (!orderSnapshotRef.current || !reference) return;
    const link = buildOrderWhatsAppLink({
      adminWhatsappNumber: settings.adminWhatsappNumber ?? "",
      reference,
      items: orderSnapshotRef.current.items.map((i) => ({
        productName: i.productName,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      total: orderSnapshotRef.current.total,
      customerName: orderSnapshotRef.current.customer.customerName,
      customerPhone: orderSnapshotRef.current.customer.customerPhone,
      customerCity: orderSnapshotRef.current.customer.customerCity,
    });
    window.open(link, "_blank");
  }

  if (step === "success") {
    return (
      <Card className="border-none shadow-none">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <h1 className="text-xl font-semibold">{t("successTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("successMessage")}</p>
          <p className="font-mono text-sm">{reference}</p>
          <Button onClick={handleSendWhatsApp} className="w-full">
            {t("sendWhatsApp")}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("backToCatalog")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {step === 1 && (
        <form onSubmit={handleSubmit(onSubmitStep1)} className="flex flex-col gap-4">
          <h2 className="text-label-xs">{t("step1Title")}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerName">{t("customerName")}</Label>
            <Input id="customerName" {...register("customerName")} />
            {errors.customerName && (
              <p className="text-sm text-destructive">{t("validationError")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerPhone">{t("customerPhone")}</Label>
            <Input
              id="customerPhone"
              inputMode="numeric"
              maxLength={8}
              {...register("customerPhone")}
            />
            {errors.customerPhone && (
              <p className="text-sm text-destructive">{t("validationError")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerCity">{t("customerCity")}</Label>
            <Input id="customerCity" {...register("customerCity")} />
            {errors.customerCity && (
              <p className="text-sm text-destructive">{t("validationError")}</p>
            )}
          </div>
          <Button type="submit">{t("next")}</Button>
        </form>
      )}

      {step === 2 && customerInfo && (
        <div className="flex flex-col gap-4">
          <h2 className="text-label-xs">{t("step2Title")}</h2>
          <div className="flex flex-col gap-2">
            {cart.items.map((line) => (
              <div key={line.variantId} className="flex justify-between text-sm">
                <span>
                  {line.productName} ({line.size}, {line.color}) x{line.quantity}
                </span>
                <span>{formatPrice(line.unitPrice * line.quantity, tCommon("currency"))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm font-medium">
              <span>{tCart("subtotal")}</span>
              <span>{formatPrice(cart.subtotal, tCommon("currency"))}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {customerInfo.customerName} · {customerInfo.customerPhone} ·{" "}
            {customerInfo.customerCity}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              {t("back")}
            </Button>
            <Button onClick={() => setStep(3)}>{t("next")}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-label-xs">{t("step3Title")}</h2>
          <div className="flex flex-col gap-1 text-sm">
            <h3 className="font-medium">{t("paymentInstructionsTitle")}</h3>
            {settings.bankilyNumber && (
              <p>
                {t("bankilyLabel")}: {settings.bankilyNumber}
              </p>
            )}
            {settings.masrivyNumber && (
              <p>
                {t("masrivyLabel")}: {settings.masrivyNumber}
              </p>
            )}
            {settings.paymentInstructions && (
              <p className="text-muted-foreground">
                {settings.paymentInstructions}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="screenshot">{t("uploadScreenshot")}</Label>
            <Input
              id="screenshot"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {t("uploadScreenshotHint")}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              {t("back")}
            </Button>
            <Button
              onClick={handleFinalSubmit}
              loading={submitting}
              disabled={!file}
              className="flex-1"
            >
              {t("submitOrder")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
