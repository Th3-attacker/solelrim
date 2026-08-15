"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Wallet, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  createWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
  moveWalletAccount,
} from "@/lib/actions/wallets";

type WalletAccount = {
  id: string;
  provider: string;
  number: string;
  logoUrl: string | null;
};

const EMPTY_FORM = { provider: "", number: "" };

export function WalletAccountsManager({ wallets }: { wallets: WalletAccount[] }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WalletAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setRemoveLogo(false);
    setOpen(true);
  }

  function openEdit(wallet: WalletAccount) {
    setEditing(wallet);
    setForm({ provider: wallet.provider, number: wallet.number });
    setLogoFile(null);
    setRemoveLogo(false);
    setOpen(true);
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set("provider", form.provider);
    formData.set("number", form.number);
    if (logoFile) {
      formData.set("logo", logoFile);
    } else if (removeLogo) {
      formData.set("removeLogo", "true");
    }

    startTransition(async () => {
      const result = editing
        ? await updateWalletAccount(editing.id, formData)
        : await createWalletAccount(formData);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteWalletAccount(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  function handleMove(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveWalletAccount(id, direction);
      if (result?.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{t("walletsSection")}</span>

      {wallets.length > 0 && (
        <div className="flex flex-col gap-2">
          {wallets.map((wallet, index) => (
            <div key={wallet.id} className="flex items-center gap-3 rounded-md border p-2">
              {wallet.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wallet.logoUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Wallet className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{wallet.provider}</span>
                <span dir="ltr" className="truncate text-xs text-muted-foreground">
                  {wallet.number}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => openEdit(wallet)}
                aria-label={tCommon("edit")}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                onClick={() => handleMove(wallet.id, "up")}
                aria-label={tCommon("moveUp")}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === wallets.length - 1}
                onClick={() => handleMove(wallet.id, "down")}
                aria-label={tCommon("moveDown")}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(wallet.id)}
                aria-label={tCommon("delete")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" className="self-start" onClick={openCreate}>
            <Plus className="size-4" />
            {t("addWallet")}
          </Button>
        }
        title={editing ? t("editWallet") : t("addWallet")}
        footer={
          <Button
            type="button"
            disabled={!form.provider.trim() || !form.number.trim()}
            loading={pending}
            onClick={handleSubmit}
          >
            {editing ? tCommon("save") : tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-provider">{t("walletProvider")}</Label>
            <Input
              id="wallet-provider"
              value={form.provider}
              placeholder={t("walletProviderPlaceholder")}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-number">{t("walletNumber")}</Label>
            <Input
              id="wallet-number"
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-logo">{t("walletLogo")}</Label>
            {editing?.logoUrl && !logoFile && !removeLogo && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editing.logoUrl}
                  alt=""
                  className="size-10 rounded-md border object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoveLogo(true)}
                >
                  <X className="size-4" />
                  {tCommon("delete")}
                </Button>
              </div>
            )}
            <Input
              id="wallet-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                setLogoFile(e.target.files?.[0] ?? null);
                setRemoveLogo(false);
              }}
            />
            <p className="text-xs text-muted-foreground">{t("walletLogoHint")}</p>
          </div>
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
