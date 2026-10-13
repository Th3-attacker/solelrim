"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateMessage } from "@/components/ui/state-message";
import { useCart } from "@/components/cart/cart-provider";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { CheckoutSuccess } from "@/components/checkout/checkout-success";
import { CustomerStep } from "@/components/checkout/customer-step";
import { WalletList } from "@/components/checkout/wallet-list";
import {
  PromoCodeField,
  usePromoCodeErrorMessage,
  type AppliedPromo,
} from "@/components/checkout/promo-code-field";
import { OrderSummary } from "@/components/checkout/order-summary";
import { submitOrder, type SubmitOrderResult } from "@/lib/actions/orders";
import { computeDiscountAmount, isPromoCodeError } from "@/lib/shop/promo-code";
import { buildOrderWhatsAppLink } from "@/lib/shop/whatsapp";
import { MAX_IMAGE_BYTES } from "@/lib/shop/image-signature";
import { Pencil, ArrowLeft, ArrowRight, ShoppingBag } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import {
  checkoutCustomerSchema,
  paymentSenderPhoneSchema,
  type CheckoutCustomerInput,
} from "@/lib/validation/order";
import { StatusAlert, FieldError } from "@/components/ui/status-alert";

type Settings = {
  wallets: { provider: string; number: string; logoUrl: string | null }[];
  adminWhatsappNumber: string | null;
  paymentInstructions: string | null;
  // UX only — hides a field that would always fail server-side anyway
  // (findValidPromoCode re-checks this per boutique, see
  // lib/shop/promo-code.ts). Never the actual trust boundary.
  couponsEnabled: boolean;
};

type Step = 1 | 2 | 3 | "success";

// What the customer is told when submitOrder refuses the order; any other
// code gets the generic "check your info" message.
const SUBMIT_ERROR_MESSAGES: Record<string, string> = {
  insufficientStock: "insufficientStockError",
  rateLimited: "rateLimitedError",
  fileTooLarge: "fileTooLarge",
  invalidFile: "invalidFileError",
  uploadFailed: "uploadFailedError",
};

// 32 hex characters. getRandomValues rather than randomUUID, which only
// exists on https (a phone testing the dev server over the LAN has none).
function newAttemptKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function CheckoutFlow({
  settings,
  storeType,
  basePath,
}: {
  settings: Settings;
  storeType: string;
  basePath: string;
}) {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const cart = useCart();

  const [step, setStep] = useState<Step>(1);
  const [customerInfo, setCustomerInfo] = useState<CheckoutCustomerInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [senderPhone, setSenderPhone] = useState("");
  const [senderPhoneError, setSenderPhoneError] = useState<string | null>(null);
  const [promoDroppedMessage, setPromoDroppedMessage] = useState<string | null>(null);
  const [paymentDetailsVisible, setPaymentDetailsVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const promoCodeErrorMessage = usePromoCodeErrorMessage();
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
    senderPhone: string;
  } | null>(null);

  // The Idempotency-Key of the order being submitted, kept while its content
  // stays the same: a retry after a lost answer (bad connection) gets the
  // order the first try placed instead of a second one. A changed cart,
  // customer, sender number or promo code is a different order, so a new key.
  const attemptRef = useRef<{ key: string; content: string } | null>(null);

  const storageKey = `solelrim-checkout-${storeType}`;
  const previousVariantIdsRef = useRef<Set<string>>(new Set());

  // A product disappearing from the cart (removed, or dropped by a stock
  // sync) means the order the customer reviewed no longer matches what's
  // in front of them — send them back to step 1 to re-confirm. Their info
  // stays filled in; only pure growth (new items added, quantities bumped,
  // nothing removed) keeps the resumed step as-is.
  useEffect(() => {
    if (!cart.hydrated) return;
    const currentIds = new Set(cart.items.map((line) => line.variantId));
    const hadRemoval = Array.from(previousVariantIdsRef.current).some((id) => !currentIds.has(id));
    previousVariantIdsRef.current = currentIds;

    if (cart.items.length === 0) {
      localStorage.removeItem(storageKey);
      if (step !== 1 && step !== "success") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(1);
      }
      return;
    }

    if (hadRemoval && step !== 1 && step !== "success") {
      setStep(1);
    }
  }, [cart.hydrated, cart.items, step, storageKey]);

  const customerForm = useForm<CheckoutCustomerInput>({
    resolver: zodResolver(checkoutCustomerSchema),
    defaultValues: { customerName: "", customerPhone: "", customerCity: "" },
  });
  const resetCustomerForm = customerForm.reset;

  // Resuming an interrupted checkout: restores step 1's info (and which
  // step they'd reached) so a reload or an accidental navigation away
  // doesn't mean retyping name/phone/city. Read in an effect, not a lazy
  // useState initializer, so this never runs during SSR.
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
  // there's nothing to save once past step 2.
  useEffect(() => {
    if (!customerInfo || step === "success") return;
    localStorage.setItem(storageKey, JSON.stringify({ step, customerInfo }));
  }, [storageKey, customerInfo, step]);

  const onSubmitStep1: SubmitHandler<CheckoutCustomerInput> = (data) => {
    setCustomerInfo(data);
    setStep(2);
  };

  async function handleFinalSubmit() {
    if (!customerInfo || !file) return;
    if (!paymentSenderPhoneSchema.safeParse(senderPhone).success) {
      setSenderPhoneError(tCommon("invalidPhone"));
      return;
    }
    const items = JSON.stringify(
      cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    );
    const content = JSON.stringify([items, customerInfo, senderPhone, appliedPromo?.code ?? null]);
    if (attemptRef.current?.content !== content) {
      attemptRef.current = { key: newAttemptKey(), content };
    }

    const formData = new FormData();
    formData.set("customerName", customerInfo.customerName);
    formData.set("customerPhone", customerInfo.customerPhone);
    formData.set("customerCity", customerInfo.customerCity);
    formData.set("paymentSenderPhone", senderPhone);
    formData.set("locale", locale);
    formData.set("productType", storeType);
    formData.set("items", items);
    formData.set("screenshot", file);
    if (appliedPromo) {
      formData.set("promoCode", appliedPromo.code);
    }

    setSubmitting(true);
    let result: SubmitOrderResult;
    try {
      result = await submitOrder(formData, { idempotencyKey: attemptRef.current.key });
    } catch {
      // No answer (connection lost, server error): the order may or may not
      // exist. The button comes back, and a retry sends the same key.
      toast.error(t("submitFailedError"));
      return;
    } finally {
      setSubmitting(false);
    }

    if (result.error || !result.reference) {
      if (isPromoCodeError(result.error)) {
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
      if (result.error === "fileTooLarge" || result.error === "invalidFile") {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFileSizeError(t(SUBMIT_ERROR_MESSAGES[result.error]));
      }
      if (result.error === "insufficientStock") {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setStep(1);
      }
      toast.error(t(SUBMIT_ERROR_MESSAGES[result.error ?? ""] ?? "validationError"));
      return;
    }

    orderSnapshotRef.current = {
      items: cart.items,
      total,
      customer: customerInfo,
      senderPhone,
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
      paymentSenderPhone: orderSnapshotRef.current.senderPhone,
    });
    window.open(link, "_blank");
  }

  if (step === "success") {
    // reference is set together with the step.
    return reference ? (
      <CheckoutSuccess
        reference={reference}
        basePath={basePath}
        onSendWhatsApp={handleSendWhatsApp}
      />
    ) : null;
  }

  // Visiting /checkout directly with nothing in the cart (or right after a
  // stock sync empties it) — nothing to check out, so send them shopping
  // instead of showing three empty steps.
  if (cart.hydrated && cart.items.length === 0) {
    return (
      <StateMessage
        heading="h1"
        icon={ShoppingBag}
        title={t("emptyCartTitle")}
        message={t("emptyCartMessage")}
        action={
          <Button asChild>
            <Link href={`${basePath}/products`}>{t("backToCatalog")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={basePath || "/"}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {t("backToShop")}
        </Link>
        <CheckoutStepper current={step} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div
          key={step}
          className="flex flex-col gap-6 rounded-2xl border bg-card p-4 duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:p-6"
        >
          {step === 1 && <CustomerStep form={customerForm} onSubmit={onSubmitStep1} />}

          {step === 2 && customerInfo && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-between gap-2 self-start rounded-lg border bg-card px-3 py-2 text-start text-sm transition-colors hover:bg-muted"
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

              <div>
                <h1 className="text-heading-xs">{t("step2Title")}</h1>
                <p className="text-sm text-muted-foreground">{t("step2Hint")}</p>
              </div>

              {settings.couponsEnabled && (
                <PromoCodeField
                  storeType={storeType}
                  customerPhone={customerInfo.customerPhone}
                  subtotal={cart.subtotal}
                  applied={appliedPromo}
                  onApply={setAppliedPromo}
                  onRemove={() => setAppliedPromo(null)}
                />
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="size-4 rtl:rotate-180" />
                  {t("back")}
                </Button>
                <Button onClick={() => setStep(3)}>
                  {t("next")}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-heading-xs">{t("step3Title")}</h1>
                {settings.paymentInstructions && (
                  <p className="text-sm text-muted-foreground">{settings.paymentInstructions}</p>
                )}
              </div>

              {!paymentDetailsVisible ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("paymentStepIntroHint")}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className="size-4 rtl:rotate-180" />
                      {t("back")}
                    </Button>
                    <Button onClick={() => setPaymentDetailsVisible(true)}>
                      {t("showPaymentNumbers")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {settings.wallets.length > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground">{t("paymentStepHint")}</p>
                      <WalletList wallets={settings.wallets} />
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="senderPhone">{t("paymentSenderPhone")}</Label>
                    <Input
                      id="senderPhone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      value={senderPhone}
                      onChange={(e) => {
                        setSenderPhone(e.target.value);
                        setSenderPhoneError(null);
                      }}
                      aria-invalid={!!senderPhoneError}
                      aria-describedby={
                        senderPhoneError ? "senderPhone-error senderPhone-hint" : "senderPhone-hint"
                      }
                    />
                    {senderPhoneError && (
                      <FieldError id="senderPhone-error">{senderPhoneError}</FieldError>
                    )}
                    <p id="senderPhone-hint" className="text-xs text-muted-foreground">
                      {t("paymentSenderPhoneHint")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="screenshot">{t("uploadScreenshot")}</Label>
                    {promoDroppedMessage && (
                      <StatusAlert variant="warning">{promoDroppedMessage}</StatusAlert>
                    )}
                    {fileSizeError && (
                      <FieldError id="screenshot-error">{fileSizeError}</FieldError>
                    )}
                    <Input
                      id="screenshot"
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-invalid={!!fileSizeError}
                      aria-describedby={
                        fileSizeError ? "screenshot-error screenshot-hint" : "screenshot-hint"
                      }
                      onChange={(e) => {
                        const picked = e.target.files?.[0] ?? null;
                        // Rejected before it ever reaches the network — the
                        // server re-checks this too (defense in depth), but
                        // failing here means no wasted upload on a slow
                        // connection and an error that actually says why.
                        if (picked && picked.size > MAX_IMAGE_BYTES) {
                          setFile(null);
                          setFileSizeError(t("fileTooLarge"));
                          e.target.value = "";
                          return;
                        }
                        setFile(picked);
                        setFileSizeError(null);
                        setPromoDroppedMessage(null);
                      }}
                    />
                    <p id="screenshot-hint" className="text-xs text-muted-foreground">
                      {t("uploadScreenshotHint")}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className="size-4 rtl:rotate-180" />
                      {t("back")}
                    </Button>
                    <Button
                      onClick={handleFinalSubmit}
                      loading={submitting}
                      disabled={!file || !senderPhone.trim()}
                      className="flex-1 sm:flex-none"
                    >
                      {t("submitOrder")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={cn("lg:sticky lg:top-24 lg:self-start", "order-first lg:order-0")}>
          <OrderSummary
            items={cart.items}
            subtotal={cart.subtotal}
            discount={discount}
            discountCode={appliedPromo?.code ?? null}
            total={total}
            currency={tCommon("currency")}
          />
        </div>
      </div>
    </div>
  );
}
