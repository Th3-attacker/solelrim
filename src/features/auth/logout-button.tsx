import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import type { Locale } from "~/i18n/config";
import { logout } from "./auth.functions";

export function LogoutButton({ locale }: { locale: Locale }) {
  const t = useTranslations("nav");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: async () => {
      // Nothing read as this admin may be shown to the next one.
      queryClient.clear();
      await navigate({ to: "/$locale/admin/login", params: { locale }, replace: true });
    },
  });

  return (
    <button
      type="button"
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      aria-busy={signOut.isPending}
      className="h-10 rounded-control border border-line-strong bg-surface px-4 font-semibold"
    >
      {t("logout")}
    </button>
  );
}
