"use client";

import { useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildClientWhatsAppLink } from "@/lib/shop/client-messages";
import { normalizeLocalPhone } from "@/lib/shop/phone";

// Opens WhatsApp on the seller's own device with the receipt pre-filled —
// they still press "send" themselves (fully automatic sending would need
// the paid WhatsApp Business API). Pre-filled with the loyalty card's
// number when the sale had one.
export function WhatsAppReceiptForm({
  message,
  defaultPhone = "",
}: {
  message: string;
  defaultPhone?: string;
}) {
  const t = useTranslations("pos");
  const [phone, setPhone] = useState(defaultPhone);

  // Accepts +222 / spaces; buildClientWhatsAppLink adds the prefix back.
  const localPhone = normalizeLocalPhone(phone);

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
          aria-invalid={phone.length > 0 && localPhone === null}
          onChange={(e) => setPhone(e.target.value)}
        />
        {localPhone ? (
          <Button asChild variant="outline">
            <a
              href={buildClientWhatsAppLink(localPhone, message)}
              target="_blank"
              rel="noopener noreferrer"
            >
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
