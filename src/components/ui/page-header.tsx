import type { ReactNode } from "react";

// The top of every page: its single h1, what it is for, and its actions
// (one primary at most).
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
