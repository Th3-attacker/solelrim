import type { ReactElement, ReactNode } from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "~/lib/cn";

const item =
  "flex h-9 w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 text-start text-[14px] text-ink no-underline outline-none select-none data-disabled:text-faint data-highlighted:bg-tile";

// A list of actions under a button, keyboard-driven (arrows, Home/End,
// typing a letter). Anything destructive goes last, after a separator.
export function Menu({
  trigger,
  align = "start",
  children,
}: {
  trigger: ReactElement;
  align?: "start" | "end";
  children: ReactNode;
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6} align={align} className="z-50 outline-none">
          <BaseMenu.Popup className="min-w-[220px] origin-(--transform-origin) rounded-xl border border-line bg-surface p-1.5 shadow-pop outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuItem({
  onClick,
  danger,
  shortcut,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  // Shown only; the page handles the key itself.
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <BaseMenu.Item onClick={onClick} className={cn(item, danger && "text-danger")}>
      {children}
      {shortcut && <kbd className="ms-auto font-sans text-[11px] text-muted">{shortcut}</kbd>}
    </BaseMenu.Item>
  );
}

// An entry that goes somewhere (render a router <Link>).
export function MenuLinkItem({ render, children }: { render: ReactElement; children: ReactNode }) {
  return (
    <BaseMenu.LinkItem render={render} className={item}>
      {children}
    </BaseMenu.LinkItem>
  );
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="mx-1 my-1.5 h-px bg-line-soft" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-label text-muted uppercase">{children}</div>;
}
