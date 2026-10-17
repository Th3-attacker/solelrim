import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useTranslations } from "use-intl";
import { Icon } from "~/components/ui/icon";
import { notify } from "~/components/ui/toast";
import { setAdminScope } from "~/features/shell/shell.functions";
import { shellQuery } from "~/features/shell/shell.queries";

// The boutique being managed. A superadmin picks another one here; everyone
// else is locked to theirs and just sees which.
export function BoutiqueSwitcher() {
  const t = useTranslations("admin.shell");
  const { data } = useSuspenseQuery(shellQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const canSwitch = data.admin.role === "SUPERADMIN" && data.boutiques.length > 1;

  const switchTo = useMutation({
    mutationFn: (key: string) => setAdminScope({ data: { key } }),
    onSuccess: async (_, key) => {
      const name = data.boutiques.find((boutique) => boutique.key === key)?.label ?? key;
      notify({ title: t("boutiqueSwitchedToast", { name }) });
      // Every page shows the chosen boutique's data: nothing cached stays.
      await queryClient.invalidateQueries();
      await router.invalidate();
    },
  });

  const card = (
    <>
      <span className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-[#1e3a5f]">
        <img src="/brand/solal-symbol-white.svg" alt="" className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[13px] leading-4 font-semibold">
          {data.boutique.label}
        </span>
        <span className="block truncate text-[11px] leading-[14px] text-muted">
          {data.boutique.domain ?? data.boutique.key}
        </span>
      </span>
    </>
  );
  const box =
    "flex w-full items-center gap-2.5 rounded-control border border-line bg-bg px-2.5 py-2 text-ink";

  if (!canSwitch) return <div className={box}>{card}</div>;

  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        aria-label={t("activeBoutiqueSwitchLabel", { name: data.boutique.label })}
        disabled={switchTo.isPending}
        className={`${box} cursor-pointer hover:border-line-strong data-popup-open:border-brand`}
      >
        {card}
        <Icon name="selector" className="size-4 text-muted" />
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6} align="start" className="z-50 outline-none">
          <BaseMenu.Popup className="w-(--anchor-width) min-w-56 rounded-xl border border-line bg-surface p-1.5 shadow-pop outline-none">
            <BaseMenu.RadioGroup
              value={data.boutique.key}
              onValueChange={(key: string) => {
                if (key !== data.boutique.key) switchTo.mutate(key);
              }}
            >
              <BaseMenu.GroupLabel className="px-2.5 pt-1.5 pb-1 text-label text-muted uppercase">
                {t("switchBoutiqueMenuTitle")}
              </BaseMenu.GroupLabel>
              {data.boutiques.map((boutique) => (
                <BaseMenu.RadioItem
                  key={boutique.key}
                  value={boutique.key}
                  // The choice is made: the menu closes, like a page link.
                  closeOnClick
                  className="flex h-10 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none data-highlighted:bg-tile"
                >
                  <span className="min-w-0 flex-1 truncate">{boutique.label}</span>
                  <BaseMenu.RadioItemIndicator>
                    <Icon name="check" className="size-4 text-brand" />
                  </BaseMenu.RadioItemIndicator>
                </BaseMenu.RadioItem>
              ))}
            </BaseMenu.RadioGroup>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
