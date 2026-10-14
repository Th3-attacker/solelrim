import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

// What a list shows when it has nothing yet: what's missing, and the way to
// add the first one.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="mb-1 inline-flex size-11 items-center justify-center rounded-control bg-tint text-brand">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="font-bold">{title}</p>
      {description && <p className="text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
