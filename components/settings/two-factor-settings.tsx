"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldSlash, ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { enrollTotpFactor, verifyTotpEnrollment, unenrollTotpFactor } from "@/lib/actions/mfa";

type EnrollmentData = { factorId: string; qrCode: string; secret: string };

export function TwoFactorSettings({
  factorId,
  required,
}: {
  factorId: string | null;
  required: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  function handleStartEnroll() {
    startTransition(async () => {
      const result = await enrollTotpFactor();
      if ("error" in result) {
        toast.error(tCommon("error"));
        return;
      }
      setEnrollment(result);
      setCode("");
      setVerifyError(false);
      setEnrollOpen(true);
    });
  }

  function handleVerify() {
    if (!enrollment) return;
    startTransition(async () => {
      const result = await verifyTotpEnrollment(enrollment.factorId, code);
      if (result.error) {
        setVerifyError(true);
        return;
      }
      setEnrollOpen(false);
      setEnrollment(null);
      router.refresh();
      toast.success(t("twoFactorEnabledToast"));
    });
  }

  function handleDisable() {
    if (!factorId) return;
    startTransition(async () => {
      const result = await unenrollTotpFactor(factorId);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setDisableOpen(false);
      router.refresh();
      toast.success(t("twoFactorDisabledToast"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("securityTitle")}</CardTitle>
        <CardDescription>{t("securitySubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {required && !factorId && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <ShieldWarning className="size-5 shrink-0" />
            {t("twoFactorRequiredNotice")}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="flex items-center gap-3">
            {factorId ? (
              <ShieldCheck className="size-5 shrink-0 text-success" />
            ) : (
              <ShieldSlash className="size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {factorId ? t("twoFactorEnabled") : t("twoFactorDisabled")}
              </span>
              <span className="text-xs text-muted-foreground">
                {factorId ? t("twoFactorEnabledHint") : t("twoFactorDisabledHint")}
              </span>
            </div>
          </div>

          {factorId ? (
            required ? (
              <span className="text-xs text-muted-foreground">
                {t("twoFactorRequiredLocked")}
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setDisableOpen(true)}
              >
                {t("twoFactorDisableButton")}
              </Button>
            )
          ) : (
            <Button type="button" loading={pending} onClick={handleStartEnroll}>
              {t("twoFactorEnableButton")}
            </Button>
          )}
        </div>
      </CardContent>

      <ResponsiveFormDialog
        open={enrollOpen}
        onOpenChange={(open) => {
          setEnrollOpen(open);
          if (!open) setEnrollment(null);
        }}
        trigger={<span />}
        title={t("twoFactorSetupTitle")}
        description={t("twoFactorSetupDescription")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={!/^\d{6}$/.test(code)}
              onClick={handleVerify}
            >
              {t("twoFactorVerifyButton")}
            </Button>
          </>
        }
      >
        {enrollment && (
          <div className="flex flex-col items-center gap-4">
            {/* Supabase returns the QR code pre-rendered as inline SVG data
                (see enrollTotpFactor) — no client-side QR library needed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollment.qrCode}
              alt={t("twoFactorSetupTitle")}
              className="size-40 rounded-md border bg-white p-2"
            />
            <div className="flex w-full flex-col gap-1 text-center">
              <p className="text-xs text-muted-foreground">{t("twoFactorSecretHint")}</p>
              <code className="rounded-md border bg-muted px-2 py-1 text-xs break-all">
                {enrollment.secret}
              </code>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="totp-verify-code">{t("twoFactorCodeLabel")}</Label>
              <Input
                id="totp-verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setVerifyError(false);
                }}
                aria-invalid={verifyError}
              />
              {verifyError && (
                <p className="text-sm text-destructive">{t("twoFactorInvalidCode")}</p>
              )}
            </div>
          </div>
        )}
      </ResponsiveFormDialog>

      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("twoFactorDisableConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("twoFactorDisableConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                handleDisable();
              }}
            >
              {tCommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
