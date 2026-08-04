import type { LucideIcon } from "lucide-react";

export function StateMessage({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon className="size-7" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-heading-xs">{title}</h1>
        {message && (
          <p className="max-w-sm text-paragraph-sm text-muted-foreground">{message}</p>
        )}
      </div>
      {action}
    </div>
  );
}
