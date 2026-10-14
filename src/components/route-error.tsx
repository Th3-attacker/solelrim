import { useEffect } from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";
import { expectedErrorCode } from "@/lib/errors";
import { Button, ButtonLink } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { isLocale } from "~/i18n/config";

// What a page shows when loading it failed. A refusal the server meant
// (signed out, no access, boutique suspended) says so; anything else offers
// to try again, without reloading the whole app.
export function RouteError({ error, reset }: ErrorComponentProps) {
  const t = useTranslations("errors");
  const router = useRouter();
  const locale = useLocale();
  const queryReset = useQueryErrorResetBoundary();
  const code = expectedErrorCode(error);

  useEffect(() => {
    if (!code) console.error(error);
    queryReset.reset();
  }, [code, error, queryReset]);

  const [title, message] =
    code === "unauthorized"
      ? [t("sessionExpiredTitle"), t("sessionExpiredMessage")]
      : code === "forbidden"
        ? [t("forbiddenTitle"), t("forbiddenMessage")]
        : code === "licenseBlocked"
          ? [t("licenseBlockedTitle"), t("licenseBlockedMessage")]
          : [t("errorTitle"), t("errorMessage")];

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <span className="inline-flex size-11 items-center justify-center rounded-control bg-bad-bg text-bad-ink">
        <Icon name="alert" className="size-5" />
      </span>
      <h1 className="text-[22px] font-bold">{title}</h1>
      <p className="text-ink-2">{message}</p>
      <div className="mt-2">
        {code === "unauthorized" ? (
          <ButtonLink
            to="/$locale/admin/login"
            params={{ locale: isLocale(locale) ? locale : "fr" }}
            variant="primary"
          >
            {t("signIn")}
          </ButtonLink>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            {t("retry")}
          </Button>
        )}
      </div>
    </div>
  );
}

// Above the language: no translations to draw on, so both main ones.
export function RootError() {
  return (
    <main role="alert" className="grid min-h-dvh place-content-center gap-2 p-6 text-center">
      <h1 className="text-page-title">Une erreur est survenue · Something went wrong</h1>
      <p>
        <Link to="/">Réessayer · Try again</Link>
      </p>
    </main>
  );
}
