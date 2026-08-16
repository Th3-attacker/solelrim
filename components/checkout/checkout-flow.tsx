"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCart } from "@/components/cart/cart-provider";
import { submitOrder } from "@/lib/actions/orders";
import { previewPromoCode } from "@/lib/actions/promo-codes";
import { computeDiscountAmount } from "@/lib/shop/promo-code";
import type { PromoDiscountType } from "@/lib/generated/prisma/enums";
import { buildOrderWhatsAppLink } from "@/lib/shop/whatsapp";
import { formatPrice } from "@/lib/format/currency";
import { Wallet, X, Pencil, PackageSearch, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkoutCustomerSchema,
  type CheckoutCustomerInput,
} from "@/lib/validation/order";

type Settings = {
  wallets: { provider: string; number: string; logoUrl: string | null }[];
  adminWhatsappNumber: string | null;
  paymentInstructions: string | null;
};

type Step = 1 | 2 | 3 | "success";

function StepDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            n <= current ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

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
  const tTrackOrder = useTranslations("trackOrder");
  const locale = useLocale();
  const { storeType } = useParams<{ storeType: string }>();
  const cart = useCart();

  const [step, setStep] = useState<Step>(1);
  const [customerInfo, setCustomerInfo] = useState<CheckoutCustomerInput | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [promoDroppedMessage, setPromoDroppedMessage] = useState<string | null>(null);
  const [paymentDetailsVisible, setPaymentDetailsVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [referenceCopied, setReferenceCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promoInput, setPromoInput] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountType: PromoDiscountType;
    discountValue: number;
  } | null>(null);
  // Derived from the live cart subtotal on every render, not frozen at
  // whatever it was when the code was applied — a PERCENT code must track
  // the cart if it changes afterward (e.g. a stock sync clamps a quantity).
  const discount = appliedPromo
    ? computeDiscountAmount(appliedPromo.discountType, appliedPromo.discountValue, cart.subtotal)
    : 0;
  const total = Math.max(cart.subtotal - discount, 0);

  // Snapshot the cart at submission time — clear() empties the live cart
  // right after success, so the WhatsApp button needs its own copy.
  const orderSnapshotRef = useRef<{
    items: typeof cart.items;
    total: number;
    customer: CheckoutCustomerInput;
  } | null>(null);

  // The drawer stays mounted across opens, so a fresh order after a
  // previous success shouldn't reopen straight onto the success screen.
  // Adjusted during render (on the `open` transition) rather than in an
  // effect, per react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && step === "success") {
      setStep(1);
      setCustomerInfo(null);
      setFile(null);
      setPromoDroppedMessage(null);
      setPaymentDetailsVisible(false);
      setReference(null);
    }
  }

  const storageKey = `solelrim-checkout-${storeType}`;
  const previousVariantIdsRef = useRef<Set<string>>(new Set());

  // A product disappearing from the cart (removed, or dropped by a stock
  // sync) means the order the customer reviewed no longer matches what's
  // in front of them — send them back to step 1 to re-confirm. Their info
  // stays filled in; only pure growth (new items added, quantities bumped,
  // nothing removed) keeps the resumed step as-is. A fully emptied cart
  // additionally drops the saved draft — there's nothing left to resume.
  useEffect(() => {
    if (!cart.hydrated) return;
    const currentIds = new Set(cart.items.map((line) => line.variantId));
    const hadRemoval = Array.from(previousVariantIdsRef.current).some(
      (id) => !currentIds.has(id),
    );
    previousVariantIdsRef.current = currentIds;

    if (cart.items.length === 0) {
      localStorage.removeItem(storageKey);
      if (step !== 1 && step !== "success") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(1);
      }
      if (open && step !== "success") onClose();
      return;
    }

    if (hadRemoval && step !== 1 && step !== "success") {
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cart.hydrated, cart.items, step, storageKey]);

  const {
    register,
    handleSubmit,
    reset: resetCustomerForm,
    formState: { errors },
  } = useForm<CheckoutCustomerInput>({
    resolver: zodResolver(checkoutCustomerSchema),
    defaultValues: { customerName: "", customerPhone: "", customerCity: "" },
  });

  // Resuming an interrupted checkout: restores step 1's info (and which
  // step they'd reached) so closing the drawer by accident doesn't mean
  // retyping name/phone/city. Read in an effect, not a lazy useState
  // initializer, so this never runs during SSR — same reasoning as
  // CartProvider's own hydration (which reaches for the same localStorage
  // -> setState-on-mount shape via a reducer's dispatch instead of a raw
  // setter, which is why only this one trips the lint heuristic below).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        step: 1 | 2 | 3;
        customerInfo: CheckoutCustomerInput;
      };
      if (!saved.customerInfo) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerInfo(saved.customerInfo);
      resetCustomerForm(saved.customerInfo);
      setStep(saved.step === 3 ? 3 : saved.step === 1 ? 1 : 2);
    } catch {
      // Malformed/foreign value — ignore, checkout just starts at step 1.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Only step 1's data is worth restoring — the payment screenshot is a
  // File (can't be serialized) and has to be re-picked either way, so
  // there's nothing to save once past step 2. customerInfo can be set
  // while step is back at 1 (a cart removal reset it) — that's saved as-is
  // so a reload right after doesn't resume past the re-confirmation.
  useEffect(() => {
    if (!customerInfo || step === "success") return;
    localStorage.setItem(storageKey, JSON.stringify({ step, customerInfo }));
  }, [storageKey, customerInfo, step]);

  function fieldErrorMessage(message?: string) {
    if (message === "required") return tCommon("requiredField");
    if (message === "invalidPhone") return tCommon("invalidPhone");
    return t("validationError");
  }

  function promoCodeErrorMessage(code: string) {
    switch (code) {
      case "expired":
        return t("promoCodeExpiredError");
      case "usageLimitReached":
        return t("promoCodeUsageLimitError");
      case "notYours":
        return t("promoCodeNotYoursError");
      default:
        return t("promoCodeInvalidError");
    }
  }

  async function handleApplyPromoCode() {
    if (!promoInput.trim() || !customerInfo) return;
    setApplyingPromo(true);
    setPromoError(null);

    const result = await previewPromoCode({
      code: promoInput,
      productType: storeType,
      customerPhone: customerInfo.customerPhone,
      subtotal: cart.subtotal,
    });
    setApplyingPromo(false);

    if ("error" in result) {
      setPromoError(promoCodeErrorMessage(result.error));
      return;
    }

    setAppliedPromo({
      code: promoInput.trim().toUpperCase(),
      discountType: result.discountType,
      discountValue: result.discountValue,
    });
  }

  function handleRemovePromoCode() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

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
    formData.set("productType", storeType);
    formData.set(
      "items",
      JSON.stringify(
        cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    );
    formData.set("screenshot", file);
    if (appliedPromo) {
      formData.set("promoCode", appliedPromo.code);
    }

    const result = await submitOrder(formData);
    setSubmitting(false);

    if (result.error || !result.reference) {
      const promoErrors = ["notFound", "expired", "usageLimitReached", "notYours"];
      if (result.error && promoErrors.includes(result.error)) {
        // The code passed preview but became invalid by the time this
        // submitted (deactivated, limit hit by someone else, etc) — the
        // total just went up from what the customer's screenshot was for.
        // Clearing the file (and the native input, so re-picking the exact
        // same one still fires onChange) forces them to look at the new
        // total and re-confirm proof of payment, instead of the disabled
        // state quietly lifting on a re-click they might not think twice about.
        setAppliedPromo(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setPromoDroppedMessage(t("promoDroppedAtSubmit"));
        toast.error(promoCodeErrorMessage(result.error));
        return;
      }
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
      total,
      customer: customerInfo,
    };
    setReference(result.reference);
    cart.clear();
    localStorage.removeItem(storageKey);
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

  async function handleCopyReference() {
    if (!reference) return;
    await navigator.clipboard.writeText(reference);
    setReferenceCopied(true);
    toast.success(t("referenceCopied"));
    setTimeout(() => setReferenceCopied(false), 2000);
  }

  if (step === "success") {
    return (
      <Card className="border-none shadow-none">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <h1 className="text-xl font-semibold">{t("successTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("successMessage")}</p>
          <div className="flex w-full flex-col items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-md border bg-muted/30 py-1.5 pr-1.5 pl-3">
              <span className="font-mono text-sm">{reference}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyReference}
                aria-label={t("copyReference")}
              >
                {referenceCopied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("keepReferenceHint")}</p>
          </div>
          <Button onClick={handleSendWhatsApp} className="w-full">
            {t("sendWhatsApp")}
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/${storeType}/track-order`} onClick={onClose}>
              <PackageSearch className="size-4" />
              {tTrackOrder("title")}
            </Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            {t("backToCatalog")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 px-4 pb-4">
        <StepDots current={step} />
        {step > 1 && customerInfo && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-start text-sm transition-colors hover:bg-muted"
          >
            <span className="truncate">
              {customerInfo.customerName} · {customerInfo.customerPhone} ·{" "}
              {customerInfo.customerCity}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              <Pencil className="size-3" />
              {t("edit")}
            </span>
          </button>
        )}
        {step > 2 && (
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{t("total")}</span>
            <span>
              {formatPrice(total, tCommon("currency"))}
              {appliedPromo && ` · ${appliedPromo.code}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div
          key={step}
          className="flex flex-col gap-6 duration-200 animate-in fade-in-0 slide-in-from-end-4"
        >
          {step === 1 && (
            <form onSubmit={handleSubmit(onSubmitStep1)} className="flex flex-col gap-4">
              <h2 className="text-label-xs">{t("step1Title")}</h2>
              <div className="flex flex-col gap-2">
                <Label htmlFor="customerName">{t("customerName")}</Label>
                <Input
                  id="customerName"
                  aria-invalid={!!errors.customerName}
                  {...register("customerName")}
                />
                {errors.customerName && (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors.customerName.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="customerPhone">{t("customerPhone")}</Label>
                <Input
                  id="customerPhone"
                  inputMode="numeric"
                  maxLength={8}
                  aria-invalid={!!errors.customerPhone}
                  {...register("customerPhone")}
                />
                {errors.customerPhone && (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors.customerPhone.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="customerCity">{t("customerCity")}</Label>
                <Input
                  id="customerCity"
                  aria-invalid={!!errors.customerCity}
                  {...register("customerCity")}
                />
                {errors.customerCity && (
                  <p className="text-sm text-destructive">
                    {fieldErrorMessage(errors.customerCity.message)}
                  </p>
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
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span>{tCart("subtotal")}</span>
                  <span>{formatPrice(cart.subtotal, tCommon("currency"))}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-sm text-primary">
                    <span>
                      {t("discount")} ({appliedPromo.code})
                    </span>
                    <span>-{formatPrice(discount, tCommon("currency"))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("total")}</span>
                  <span>{formatPrice(total, tCommon("currency"))}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="promoCode">{t("promoCode")}</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                    <span className="font-mono font-medium">{appliedPromo.code}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleRemovePromoCode}
                      aria-label={t("removePromoCode")}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="promoCode"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value);
                        setPromoError(null);
                      }}
                      placeholder={t("promoCodePlaceholder")}
                      aria-invalid={!!promoError}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      loading={applyingPromo}
                      disabled={!promoInput.trim()}
                      onClick={handleApplyPromoCode}
                    >
                      {t("applyPromoCode")}
                    </Button>
                  </div>
                )}
                {promoError && <p className="text-sm text-destructive">{promoError}</p>}
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
              {settings.paymentInstructions && (
                <p className="text-sm text-muted-foreground">
                  {settings.paymentInstructions}
                </p>
              )}

              {!paymentDetailsVisible ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("paymentStepIntroHint")}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      {t("back")}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setPaymentDetailsVisible(true)}
                    >
                      {t("showPaymentNumbers")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {settings.wallets.length > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground">{t("paymentStepHint")}</p>
                      <div className="grid grid-cols-2 gap-2">
                      {settings.wallets.map((wallet, index) => (
                        <Popover key={index}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border bg-muted/30 p-2.5 text-center transition-colors hover:bg-muted/50"
                            >
                              {wallet.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={wallet.logoUrl}
                                  alt=""
                                  className="size-8 shrink-0 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Wallet className="size-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex min-w-0 flex-col items-center">
                                <span className="truncate text-xs font-medium text-muted-foreground">
                                  {wallet.provider}
                                </span>
                                <span dir="ltr" className="truncate text-sm font-semibold">
                                  {wallet.number}
                                </span>
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 text-center text-sm">
                            {t("walletNumberHint", { provider: wallet.provider })}
                          </PopoverContent>
                        </Popover>
                      ))}
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="screenshot">{t("uploadScreenshot")}</Label>
                    {promoDroppedMessage && (
                      <p className="text-sm text-destructive">{promoDroppedMessage}</p>
                    )}
                    <Input
                      id="screenshot"
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setPromoDroppedMessage(null);
                      }}
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
