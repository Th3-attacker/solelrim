"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateSolalContact } from "@/lib/actions/settings";

type SolalContactValues = {
  address: string;
  phone: string;
  email: string;
  website: string;
};

// Fills the "[à compléter]" placeholders on the auto-generated license
// contract's section 34 (components/settings/license-contract-document.tsx)
// — SOLAL's own address/phone/email/website. A superadmin edits these here
// instead of a hardcoded constant, so no code change/redeploy is ever
// needed to fill them in or update them later.
export function SolalContactForm({ contact }: { contact: SolalContactValues }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(contact);

  function setField(field: keyof SolalContactValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSolalContact(values);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(tCommon("save"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("solalContactSection")}</CardTitle>
        <CardDescription>{t("solalContactHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="solal-address">{t("solalAddress")}</Label>
            <Input
              id="solal-address"
              value={values.address}
              onChange={(e) => setField("address", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="solal-phone">{t("solalPhone")}</Label>
            <Input
              id="solal-phone"
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="solal-email">{t("solalEmail")}</Label>
            <Input
              id="solal-email"
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="solal-website">{t("solalWebsite")}</Label>
            <Input
              id="solal-website"
              value={values.website}
              onChange={(e) => setField("website", e.target.value)}
            />
          </div>
        </div>
        <Button type="button" loading={pending} onClick={handleSave} className="self-start">
          {tCommon("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
