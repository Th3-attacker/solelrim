"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { createBoutiqueAdmin, deleteBoutiqueAdmin } from "@/lib/actions/admin-users";

type BoutiqueAdmin = {
  id: string;
  email: string | null;
  boutiqueLabel: string | null;
};

type StoreTypeOption = { key: string; label: string };

export function AdminUsersManager({
  admins,
  storeTypes,
}: {
  admins: BoutiqueAdmin[];
  storeTypes: StoreTypeOption[];
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [productType, setProductType] = useState(storeTypes[0]?.key ?? "");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createBoutiqueAdmin({ email, password, productType });
      if (result.error) {
        toast.error(tCommon("error"));
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
      const result = await deleteBoutiqueAdmin(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {admins.length > 0 && (
        <div className="flex flex-col gap-2">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{admin.email}</span>
                <span className="text-xs text-muted-foreground">{admin.boutiqueLabel}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(admin.id)}
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
            {t("newAdminUser")}
          </Button>
        }
        title={t("newAdminUser")}
        footer={
          <Button
            type="button"
            disabled={!email.trim() || password.trim().length < 8 || !productType}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-user-email">{t("adminUserEmail")}</Label>
            <Input
              id="admin-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-user-password">{t("adminUserPassword")}</Label>
            <Input
              id="admin-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("adminUserPasswordHint")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-user-boutique">{t("adminUserBoutique")}</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger id="admin-user-boutique" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {storeTypes.map((type) => (
                  <SelectItem key={type.key} value={type.key}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
