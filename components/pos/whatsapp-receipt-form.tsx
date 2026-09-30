"use client";

import { useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildClientWhatsAppLink } from "@/lib/shop/client-messages";
import { checkoutCustomerSchema } from "@/lib/validation/order";

// Opens WhatsApp on the seller's own device with the receipt pre-filled —
// they still press "send" themselves (fully automatic sending would need
// the paid WhatsApp Business API). Same local-number rule as the storefront
// checkout, so the +222 prefix buildClientWhatsAppLink adds is always right.
export function WhatsAppReceiptForm({ message }: { message: string }) {
  const t = useTranslations("pos");
  const [phone, setPhone] = useState("");

  const digits = phone.replace(/\D/g, "");
  const isValid = checkoutCustomerSchema.shape.customerPhone.safeParse(digits).success;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="receipt-phone">{t("receiptPhone")}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="receipt-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="off"
          placeholder="22 12 34 56"
          className="w-44"
          value={phone}
          aria-invalid={phone.length > 0 && !isValid}
          onChange={(e) => setPhone(e.target.value)}
        />
        {isValid ? (
          <Button asChild variant="outline">
            <a href={buildClientWhatsAppLink(digits, message)} target="_blank" rel="noopener noreferrer">
              <WhatsappLogo className="size-4" />
              {t("sendWhatsApp")}
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            <WhatsappLogo className="size-4" />
            {t("sendWhatsApp")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("receiptPhoneHint")}</p>
    </div>
  );
}
