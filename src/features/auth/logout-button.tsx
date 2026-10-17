import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { Button, IconButton } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import type { Locale } from "~/i18n/config";
import { logout } from "./auth.functions";

export function LogoutButton({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
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

  if (compact) {
    return (
      <IconButton
        label={t("logout")}
        variant="quiet"
        className="text-muted"
        busy={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        <Icon name="logout" />
      </IconButton>
    );
  }
  return (
    <Button busy={signOut.isPending} onClick={() => signOut.mutate()}>
      <Icon name="logout" />
      {t("logout")}
    </Button>
  );
}
