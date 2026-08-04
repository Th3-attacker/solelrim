"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  createWalletAccount,
  deleteWalletAccount,
  moveWalletAccount,
} from "@/lib/actions/wallets";
import { WALLET_PROVIDERS, WALLET_PROVIDER_KEYS } from "@/lib/shop/wallets";
import type { WalletProvider } from "@/lib/generated/prisma/enums";

type WalletAccount = { id: string; provider: WalletProvider; number: string };

export function WalletAccountsManager({ wallets }: { wallets: WalletAccount[] }) {
  const t = useTranslations("settings");
  const tWallets = useTranslations("wallets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<WalletProvider | "">("");
  const [number, setNumber] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createWalletAccount({ provider, number });
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setProvider("");
      setNumber("");
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={WALLET_PROVIDERS[wallet.provider].logo}
                alt=""
                className="size-8 shrink-0 rounded-md"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">
                  {tWallets(wallet.provider.toLowerCase())}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {wallet.number}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                onClick={() => handleMove(wallet.id, "up")}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === wallets.length - 1}
                onClick={() => handleMove(wallet.id, "down")}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(wallet.id)}
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
          <Button type="button" variant="outline" className="self-start">
            <Plus className="size-4" />
            {t("addWallet")}
          </Button>
        }
        title={t("addWallet")}
        footer={
          <Button
            type="button"
            disabled={!provider || !number.trim()}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-provider">{t("walletProvider")}</Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as WalletProvider)}
            >
              <SelectTrigger id="wallet-provider" className="w-full">
                <SelectValue placeholder={t("walletProvider")} />
              </SelectTrigger>
              <SelectContent>
                {WALLET_PROVIDER_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={WALLET_PROVIDERS[key].logo}
                        alt=""
                        className="size-5 rounded"
                      />
                      {tWallets(key.toLowerCase())}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-number">{t("walletNumber")}</Label>
            <Input
              id="wallet-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
