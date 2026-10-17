import { useState, type ReactElement, type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { cn } from "~/lib/cn";
import { useDirection } from "~/i18n/use-direction";
import { Button, IconButton } from "./button";
import { Icon } from "./icon";

// Above the sticky header and the phone's tab bar (z-30).
const backdrop =
  "fixed inset-0 z-50 min-h-dvh bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";
const popup =
  "fixed z-50 top-1/2 left-1/2 flex max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-dialog border border-line bg-surface text-ink shadow-pop transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0";

// A window for a short task (a new seller, an edit). Focus moves in, Escape
// and the close button leave, the page behind is inert.
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel,
  footer,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The button that opens it, when the dialog owns its own state.
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <BaseDialog.Trigger render={trigger} />}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdrop} />
        <BaseDialog.Popup className={popup}>
          <div className="flex items-start justify-between gap-3 px-6 pt-5">
            <div>
              <BaseDialog.Title className="text-[18px] font-bold">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-1 text-[14px] text-muted">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              render={
                <IconButton label={closeLabel} variant="quiet" size="sm" className="text-ink" />
              }
            >
              <Icon name="close" />
            </BaseDialog.Close>
          </div>
          {children && <div className="flex flex-col gap-4 px-6 py-5">{children}</div>}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-6 py-4">
              {footer}
            </div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// Asked before anything that can't be undone. The confirm button says the
// verb ("Oui, supprimer"); cancelling is the safe, focused default.
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  busy,
  tone = "danger",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  tone?: "danger" | "primary";
}) {
  // Uncontrolled unless the caller passes `open`: confirming closes it.
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={setOpen}>
      {trigger && <AlertDialog.Trigger render={trigger} />}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={backdrop} />
        <AlertDialog.Popup className={cn(popup, "w-[min(26rem,calc(100vw-2rem))] gap-4 p-6")}>
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-[18px] font-bold">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-[14px] text-ink-2">
                {description}
              </AlertDialog.Description>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Close render={<Button variant="secondary" />}>
              {cancelLabel}
            </AlertDialog.Close>
            <Button
              variant={tone}
              busy={busy}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// A panel from the edge: the menu from the start side, confirmations and
// pickers from the bottom on phones. Swiped away like a native sheet.
export function Sheet({
  open,
  onOpenChange,
  side,
  title,
  titleHidden = false,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "start" | "end" | "bottom";
  title: ReactNode;
  // The title still names the panel for screen readers.
  titleHidden?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const fromBottom = side === "bottom";
  const rtl = useDirection() === "rtl";
  // The physical edge it slides from: start is the left in French, the right
  // in Arabic; end the other way round.
  const fromRight = (side === "end") !== rtl;
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection={fromBottom ? "down" : fromRight ? "right" : "left"}
    >
      <Drawer.Portal>
        <Drawer.Backdrop
          className={cn(
            backdrop,
            "opacity-[calc(1-var(--drawer-swipe-progress))] data-swiping:duration-0",
          )}
        />
        <Drawer.Viewport
          className={cn(
            "fixed inset-0 z-50 flex",
            fromBottom ? "items-end" : "items-stretch",
            // Logical: the end edge, whichever way the page reads.
            side === "end" && "justify-end",
          )}
        >
          <Drawer.Popup
            className={cn(
              "flex flex-col overflow-y-auto overscroll-contain bg-surface text-ink shadow-pop outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-swiping:select-none",
              fromBottom
                ? "max-h-[90dvh] w-full rounded-t-sheet pb-[env(safe-area-inset-bottom)] [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]"
                : cn(
                    side === "end"
                      ? "h-full w-[min(30rem,100vw)]"
                      : "h-full w-[min(20rem,calc(100vw-3rem))]",
                    "[transform:translateX(var(--drawer-swipe-movement-x))]",
                    fromRight
                      ? "data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]"
                      : "data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)]",
                  ),
              className,
            )}
          >
            <Drawer.Title className={titleHidden ? "sr-only" : "px-5 pt-5 text-[18px] font-bold"}>
              {title}
            </Drawer.Title>
            {children}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export const SheetClose = Drawer.Close;
