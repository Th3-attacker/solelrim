import { useId, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import type { Locale } from "~/i18n/config";
import { login, verifyLoginMfa } from "./auth.functions";
import { adminSessionQuery } from "./auth.queries";
import { loginSchema, mfaCodeSchema } from "./auth.schemas";

type ErrorKey = "error" | "rateLimitedError" | "mfaInvalidCode";

// Sign-in in two steps when the admin has 2FA: password, then the code. The
// layout is the plain step-0 one; the "Connexion" design replaces it later.
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
    <section
      aria-labelledby="login-title"
      className="w-full max-w-sm rounded-card border border-line bg-surface p-6"
    >
      <h1 id="login-title" className="text-page-title">
        {step === "password" ? t("title") : t("mfaTitle")}
      </h1>
      <p className="mt-1.5 text-muted">{step === "password" ? t("subtitle") : t("mfaSubtitle")}</p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-control bg-bad-bg px-3 py-2 text-[13px] font-medium text-bad-ink"
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
    </section>
  );
}

function PasswordStep({
  onError,
  onDone,
}: {
  onError: (key: ErrorKey) => void;
  onDone: (status: "signedIn" | "mfaRequired") => Promise<void>;
}) {
  const t = useTranslations();
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
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
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-[13px] font-semibold">
              {t("auth.login.email")}
            </label>
            <input
              id={field.name}
              name={field.name}
              type="email"
              dir="ltr"
              required
              autoComplete="username"
              autoFocus
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0 || undefined}
              className="h-[42px] rounded-control border border-line-strong bg-surface px-3 text-[14px]"
            />
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordId} className="text-[13px] font-semibold">
              {t("auth.login.password")}
            </label>
            <div className="flex h-[42px] items-center rounded-control border border-line-strong bg-surface focus-within:outline-2 focus-within:outline-brand">
              <input
                id={passwordId}
                name={field.name}
                type={showPassword ? "text" : "password"}
                dir="ltr"
                required
                autoComplete="current-password"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-controls={passwordId}
                aria-pressed={showPassword}
                className="h-full px-3 text-[13px] font-semibold text-brand"
              >
                {showPassword ? t("common.hidePassword") : t("common.showPassword")}
              </button>
            </div>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => <SubmitButton busy={busy} label={t("auth.login.submit")} />}
      </form.Subscribe>
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

  const form = useForm({
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
    // A code that isn't six digits never leaves the browser.
    onSubmitInvalid: () => onError("mfaInvalidCode"),
  });

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="code">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-[13px] font-semibold">
              {t("mfaCode")}
            </label>
            <input
              id={field.name}
              name={field.name}
              required
              inputMode="numeric"
              dir="ltr"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value.replace(/\D/g, ""))}
              onBlur={field.handleBlur}
              className="h-[42px] rounded-control border border-line-strong bg-surface px-3 text-[18px] tracking-[0.3em]"
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => <SubmitButton busy={busy} label={t("mfaSubmit")} />}
      </form.Subscribe>
      <button type="button" onClick={onBack} className="text-[13px] font-semibold text-brand">
        {t("mfaOtherAccount")}
      </button>
    </form>
  );
}

// The step's single main action, busy while the server answers.
function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="h-12 rounded-control bg-brand font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
    >
      {label}
    </button>
  );
}
