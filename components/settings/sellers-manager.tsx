"use client";

import { useState, useTransition } from "react";
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { createSeller, deleteSeller, setSellerQuota } from "@/lib/actions/sellers";

type Seller = { id: string; email: string | null };

const CREATE_ERRORS = new Set(["emailExists", "quotaReached"]);

export function SellersManager({
  productType,
  sellers,
  quota,
  canEditQuota,
}: {
  productType: string;
  sellers: Seller[];
  quota: number;
  canEditQuota: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quotaValue, setQuotaValue] = useState(String(quota));

  const quotaReached = sellers.length >= quota;

  function handleCreate() {
    startTransition(async () => {
      const result = await createSeller({ email, password });
      if (result.error) {
        toast.error(
          CREATE_ERRORS.has(result.error) ? t(`sellerError.${result.error}`) : tCommon("error"),
        );
        return;
      }
      setEmail("");
      setPassword("");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSeller(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  function handleSaveQuota() {
    startTransition(async () => {
      const result = await setSellerQuota(productType, Number(quotaValue));
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{t("sellersSection")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("sellersCount", { count: sellers.length, quota })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{t("sellersHint")}</p>

      {sellers.length > 0 && (
        <div className="flex flex-col gap-2">
          {sellers.map((seller) => (
            <div key={seller.id} className="flex items-center gap-2 rounded-md border p-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{seller.email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(seller.id)}
                aria-label={tCommon("delete")}
              >
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {quotaReached && !canEditQuota && (
        <p className="text-sm text-muted-foreground">{t("sellersQuotaReachedHint")}</p>
      )}

      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" className="self-start" disabled={quotaReached}>
            <Plus className="size-4" />
            {t("newSeller")}
          </Button>
        }
        title={t("newSeller")}
        footer={
          <Button
            type="button"
            disabled={!email.trim() || password.length < 8}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-email">{t("adminUserEmail")}</Label>
            <Input
              id="seller-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-password">{t("adminUserPassword")}</Label>
            <PasswordInput
              id="seller-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showLabel={tCommon("showPassword")}
              hideLabel={tCommon("hidePassword")}
            />
            <p className="text-xs text-muted-foreground">{t("adminUserPasswordHint")}</p>
          </div>
        </div>
      </ResponsiveFormDialog>

      {canEditQuota && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-quota">{t("sellerQuota")}</Label>
            <Input
              id="seller-quota"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              className="w-24"
              value={quotaValue}
              onChange={(e) => setQuotaValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            loading={pending}
            disabled={quotaValue === String(quota)}
            onClick={handleSaveQuota}
          >
            {tCommon("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
