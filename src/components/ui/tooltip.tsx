import { Tooltip } from "@base-ui/react/tooltip";
import { Icon } from "./icon";

// A "?" next to a term, explaining it ("Écart = compté − attendu"). Opens on
// hover and on keyboard focus; the explanation is also its accessible name.
export function InfoTip({ children }: { children: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={children}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-tile hover:text-ink"
      >
        <Icon name="help" className="size-4" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-50">
          <Tooltip.Popup className="max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-medium text-surface shadow-pop transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            {children}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
