import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { useAppForm } from "~/components/form/form";
import { Icon } from "~/components/ui/icon";
import type { Locale } from "~/i18n/config";
import { login, verifyLoginMfa } from "./auth.functions";
import { adminSessionQuery } from "./auth.queries";
import { loginSchema, mfaCodeSchema } from "./auth.schemas";

type ErrorKey = "error" | "rateLimitedError" | "mfaInvalidCode";

// Sign-in in two steps when the admin has 2FA: password, then the code.
export function LoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth.login");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [error, setError] = useState<ErrorKey | null>(null);

  async function enterAdmin() {
    // The session changed: the next page asks the server again.
    queryClient.removeQueries({ queryKey: adminSessionQuery.queryKey });
    await navigate({ to: "/$locale/admin", params: { locale }, replace: true });
  }

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-[18px]">
      <div>
        <h1 className="text-page-title">
          {step === "password" ? t("welcomeTitle") : t("mfaTitle")}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {step === "password" ? t("welcomeSubtitle") : t("mfaSubtitle")}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-control bg-bad-bg px-3 py-2.5 text-[13px] font-medium text-bad-ink"
        >
          {t(error)}
        </p>
      )}

      {step === "password" ? (
        <PasswordStep
          onError={setError}
          onDone={async (status) => {
            setError(null);
            if (status === "mfaRequired") setStep("mfa");
            else await enterAdmin();
          }}
        />
      ) : (
        <MfaStep
          onError={setError}
          onDone={async (status) => {
            setError(null);
            if (status === "restart") setStep("password");
            else await enterAdmin();
          }}
          onBack={() => {
            setError(null);
            setStep("password");
          }}
        />
      )}
    </div>
  );
}

// method="post": a press on "Se connecter" before the page's script has
// loaded never puts the password in the address bar.
const formProps = {
  method: "post",
  noValidate: true,
  className: "flex flex-col gap-[18px]",
} as const;

function PasswordStep({
  onError,
  onDone,
}: {
  onError: (key: ErrorKey) => void;
  onDone: (status: "signedIn" | "mfaRequired") => Promise<void>;
}) {
  const t = useTranslations();
  const [showPassword, setShowPassword] = useState(false);

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      const result = await login({ data: value });
      if ("error" in result) {
        onError(result.error === "rateLimited" ? "rateLimitedError" : "error");
        return;
      }
      await onDone(result.status);
    },
  });

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("auth.login.emailAddress")}
            type="email"
            dir="ltr"
            autoComplete="username"
            placeholder="vous@exemple.com"
            required
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("auth.login.password")}
            type={showPassword ? "text" : "password"}
            dir="ltr"
            autoComplete="current-password"
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-pressed={showPassword}
                className="-me-1.5 h-8 rounded-lg bg-tile px-2.5 text-[12px] font-semibold text-brand"
              >
                {showPassword ? t("common.hidePassword") : t("common.showPassword")}
              </button>
            }
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton label={t("auth.login.submit")} />
      </form.AppForm>
      <p className="flex items-start gap-2 text-[13px] text-muted">
        <Icon name="shield" className="mt-px size-4" />
        {t("auth.login.twoStepNotice")}
      </p>
    </form>
  );
}

function MfaStep({
  onError,
  onDone,
  onBack,
}: {
  onError: (key: ErrorKey) => void;
  onDone: (status: "signedIn" | "restart") => Promise<void>;
  onBack: () => void;
}) {
  const t = useTranslations("auth.login");

  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onSubmit: mfaCodeSchema },
    onSubmit: async ({ value }) => {
      const result = await verifyLoginMfa({ data: value });
      if ("error" in result) {
        onError(result.error === "rateLimited" ? "rateLimitedError" : "mfaInvalidCode");
        return;
      }
      await onDone(result.status);
    },
  });

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="code">
        {(field) => (
          <field.TextField
            label={t("mfaCode")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton label={t("mfaSubmit")} />
      </form.AppForm>
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[13px] font-semibold text-brand"
      >
        {t("mfaOtherAccount")}
      </button>
    </form>
  );
}
