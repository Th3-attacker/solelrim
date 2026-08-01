"use client";

import { useTransition } from "react";
import { ChevronsUpDown, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setAdminScope } from "@/lib/actions/admin-scope";
import { isProductType } from "@/lib/shop/product-type";

type StoreTypeOption = { key: string; label: string };

// Independent from the public "live" toggle (Réglages) — lets an admin
// browse/manage one boutique's back office while another is currently live
// to customers. See lib/shop/admin-scope.ts.
export function StoreScopeSwitcher({
  storeTypes,
  currentScope,
}: {
  storeTypes: StoreTypeOption[];
  currentScope: string;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const current = storeTypes.find((s) => s.key === currentScope);
  const currentLabel = current
    ? isProductType(current.key)
      ? t(`productTypes.${current.key}`)
      : current.label
    : currentScope;

  function handleSelect(key: string) {
    if (key === currentScope || pending) return;
    startTransition(async () => {
      const result = await setAdminScope(key);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={pending}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Store className="size-4 shrink-0" />
            <span className="truncate">{currentLabel}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        {storeTypes.map(({ key, label }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={key === currentScope}
            onSelect={() => handleSelect(key)}
          >
            {isProductType(key) ? t(`productTypes.${key}`) : label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
