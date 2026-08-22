"use client";

import { useState, useTransition } from "react";
import { CalendarBlank, Pencil, Trash } from "@phosphor-icons/react/dist/ssr";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { fr, enUS, arMA } from "date-fns/locale";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { getLicenseStatus, type LicenseStatus } from "@/lib/shop/license";
import {
  updateStoreDomain,
  updateLicenseExpiresAt,
  updateStoreTypeLabel,
  deleteStoreType,
} from "@/lib/actions/settings";

const CALENDAR_LOCALES: Record<string, typeof fr> = { fr, en: enUS, ar: arMA };

const STATUS_BADGE_VARIANT: Record<LicenseStatus, "outline" | "warning" | "destructive"> = {
  unrestricted: "outline",
  ok: "outline",
  expiringSoon: "warning",
  expired: "destructive",
};

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type StoreTypeRow = {
  key: string;
  label: string;
  domain: string | null;
  licenseExpiresAt: Date | null;
};

export function BoutiqueLicenseManager({ storeTypes }: { storeTypes: StoreTypeRow[] }) {
  const t = useTranslations("settings");

  return (
    <div className="flex flex-col gap-2">
      {storeTypes.map((storeType) => (
        <BoutiqueLicenseRow key={storeType.key} storeType={storeType} />
      ))}
      {storeTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noBoutiques")}</p>
      )}
    </div>
  );
}

function BoutiqueLicenseRow({ storeType }: { storeType: StoreTypeRow }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [domainOpen, setDomainOpen] = useState(false);
  const [domainValue, setDomainValue] = useState(storeType.domain ?? "");

  const [dateOpen, setDateOpen] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [labelValue, setLabelValue] = useState(storeType.label);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const status = getLicenseStatus(storeType.licenseExpiresAt);

  function handleSaveDomain() {
    startTransition(async () => {
      const result = await updateStoreDomain(storeType.key, domainValue);
      if (result.error) {
        toast.error(t(`domainError.${result.error}`));
        return;
      }
      setDomainOpen(false);
      router.refresh();
    });
  }

  function handleSaveLabel() {
    startTransition(async () => {
      const result = await updateStoreTypeLabel(storeType.key, labelValue);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setRenameOpen(false);
      router.refresh();
    });
  }

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteStoreType(storeType.key);
      if (result.error) {
        setDeleteError(t(`boutiqueError.${result.error}`));
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    });
  }

  function handleSelectDate(date: Date | undefined) {
    startTransition(async () => {
      const result = await updateLicenseExpiresAt(
        storeType.key,
        date ? toDateParam(date) : null,
      );
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setDateOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{storeType.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {storeType.domain ?? t("domainNotSet")}
        </span>
      </div>

      <Badge variant={STATUS_BADGE_VARIANT[status]}>
        {t(`licenseStatus.${status}`)}
      </Badge>

      <ResponsiveFormDialog
        open={renameOpen}
        onOpenChange={(open) => {
          if (open) setLabelValue(storeType.label);
          setRenameOpen(open);
        }}
        trigger={
          <Button type="button" variant="outline" size="sm">
            <Pencil className="size-3.5" />
            {tCommon("edit")}
          </Button>
        }
        title={t("boutiqueRenameTitle", { label: storeType.label })}
        footer={
          <Button type="button" loading={pending} onClick={handleSaveLabel}>
            {tCommon("save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`label-${storeType.key}`}>{t("boutiqueNameLabel")}</Label>
          <Input
            id={`label-${storeType.key}`}
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
          />
        </div>
      </ResponsiveFormDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open) setDeleteError(null);
          setDeleteOpen(open);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Trash className="size-3.5" />
            {tCommon("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("boutiqueDeleteConfirmTitle", { label: storeType.label })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ?? t("boutiqueDeleteConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              {pending ? <Spinner /> : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResponsiveFormDialog
        open={domainOpen}
        onOpenChange={(open) => {
          if (open) setDomainValue(storeType.domain ?? "");
          setDomainOpen(open);
        }}
        trigger={
          <Button type="button" variant="outline" size="sm">
            <Pencil className="size-3.5" />
            {t("domainEdit")}
          </Button>
        }
        title={t("domainEditTitle", { label: storeType.label })}
        footer={
          <Button type="button" loading={pending} onClick={handleSaveDomain}>
            {tCommon("save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`domain-${storeType.key}`}>{t("domain")}</Label>
          <Input
            id={`domain-${storeType.key}`}
            placeholder={t("domainPlaceholder")}
            value={domainValue}
            onChange={(e) => setDomainValue(e.target.value)}
          />
        </div>
      </ResponsiveFormDialog>

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <CalendarBlank className="size-3.5" />
            {storeType.licenseExpiresAt
              ? format.dateTime(storeType.licenseExpiresAt, { dateStyle: "medium" })
              : t("licenseExtend")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={CALENDAR_LOCALES[locale] ?? enUS}
            selected={storeType.licenseExpiresAt ?? undefined}
            onSelect={handleSelectDate}
          />
          {storeType.licenseExpiresAt && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                loading={pending}
                onClick={() => handleSelectDate(undefined)}
              >
                {t("licenseClear")}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
