import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { cn } from "~/lib/cn";
import { Icon } from "./icon";

// One manager for the whole app: a notification can be sent from anywhere,
// a mutation's onSuccess included, without a hook.
export const toasts = Toast.createToastManager();

type Tone = "success" | "error" | "info";

export function notify({
  title,
  description,
  tone = "success",
  action,
}: {
  title: string;
  description?: string;
  tone?: Tone;
  // "Annuler" after a deletion, for instance.
  action?: { label: string; onClick: () => void };
}) {
  toasts.add({
    title,
    description,
    type: tone,
    // An error is read out at once; the others wait for a pause.
    priority: tone === "error" ? "high" : "low",
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  });
}

// Mounted once around the app. Notifications leave by themselves after
// 5 seconds (paused while hovered or focused), at the bottom on the end side.
export function ToastProvider({
  children,
  closeLabel,
}: {
  children: ReactNode;
  closeLabel: string;
}) {
  return (
    <Toast.Provider toastManager={toasts} timeout={5000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-60 mx-auto flex max-w-sm flex-col gap-2 outline-none max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:start-auto sm:end-6 sm:mx-0 sm:w-full">
          <ToastList closeLabel={closeLabel} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

const TONE: Record<Tone, { icon: "check" | "alert" | "info"; className: string }> = {
  success: { icon: "check", className: "text-ok-ink" },
  error: { icon: "alert", className: "text-bad-ink" },
  info: { icon: "info", className: "text-brand" },
};

function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts: list } = Toast.useToastManager();
  return list.map((toast) => {
    const tone = TONE[(toast.type as Tone | undefined) ?? "info"] ?? TONE.info;
    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-ink shadow-pop transition-[opacity,transform] duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
      >
        <Icon name={tone.icon} className={cn("mt-px", tone.className)} />
        <Toast.Content className="min-w-0 flex-1">
          <Toast.Title className="text-[14px] font-semibold" />
          <Toast.Description className="text-[13px] text-muted" />
        </Toast.Content>
        <Toast.Action className="h-8 rounded-lg px-2 text-[13px] font-semibold text-brand hover:bg-tint" />
        <Toast.Close
          aria-label={closeLabel}
          className="inline-flex size-8 flex-none items-center justify-center rounded-lg text-muted hover:bg-tile hover:text-ink"
        >
          <Icon name="close" className="size-4" />
        </Toast.Close>
      </Toast.Root>
    );
  });
}
