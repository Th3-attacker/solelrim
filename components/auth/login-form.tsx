"use client";

import { useActionState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { login, logout, verifyLoginMfa, type LoginState, type MfaState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const initialLoginState: LoginState = {};
const initialMfaState: MfaState = {};

export function LoginForm({
  initialStep = "credentials",
}: {
  initialStep?: "credentials" | "mfa";
}) {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [loginState, loginAction, loginPending] = useActionState(login, initialLoginState);
  const [mfaState, mfaAction, mfaPending] = useActionState(verifyLoginMfa, initialMfaState);
  const [loggingOut, startLogout] = useTransition();

  // Once login() reports mfaRequired, its state keeps that flag set on every
  // re-render until the next submit — so this stays "mfa" without needing
  // an effect to sync it into separate local state.
  const step = initialStep === "mfa" || loginState.mfaRequired ? "mfa" : "credentials";

  if (step === "mfa") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("mfaTitle")}</CardTitle>
          <CardDescription>{t("mfaSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={mfaAction} className="flex flex-col gap-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">{t("mfaCode")}</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                aria-invalid={!!mfaState.error}
              />
            </div>
            {mfaState.error && (
              <p className="text-sm text-destructive">
                {mfaState.error === "rateLimited" ? t("rateLimitedError") : t("mfaInvalidCode")}
              </p>
            )}
            <Button type="submit" loading={mfaPending} className="w-full">
              {t("mfaSubmit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loggingOut}
              loading={loggingOut}
              onClick={() => startLogout(() => logout(locale))}
            >
              {t("mfaOtherAccount")}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              aria-invalid={!!loginState.error}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              aria-invalid={!!loginState.error}
              showLabel={tCommon("showPassword")}
              hideLabel={tCommon("hidePassword")}
            />
          </div>
          {loginState.error && (
            <p className="text-sm text-destructive">
              {loginState.error === "rateLimited" ? t("rateLimitedError") : t("error")}
            </p>
          )}
          <Button type="submit" loading={loginPending} className="w-full">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
