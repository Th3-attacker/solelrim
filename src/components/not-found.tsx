import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

// What an unknown address shows, in the visitor's language.
export function NotFound() {
  const t = useTranslations("errors");
  return (
    <main className="grid min-h-dvh place-content-center gap-3 p-6 text-center">
      <h1 className="text-page-title">{t("notFoundTitle")}</h1>
      <p className="text-muted">{t("notFoundMessage")}</p>
      <p>
        <Link to="/" className="font-semibold">
          {t("backToShop")}
        </Link>
      </p>
    </main>
  );
}
