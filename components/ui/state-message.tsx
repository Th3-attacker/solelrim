import type { Icon } from "@phosphor-icons/react";

export function StateMessage({
  icon: Icon,
  title,
  message,
  detail,
  action,
  heading: Heading = "h2",
}: {
  icon: Icon;
  title: string;
  message?: string;
  // Small print under the message, e.g. an error's reference to quote.
  detail?: React.ReactNode;
  action?: React.ReactNode;
  // h1 when this is all the page says (error, not found, empty checkout);
  // h2 under a page's own title.
  heading?: "h1" | "h2";
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border bg-card text-primary">
        <Icon className="size-7" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Heading className="text-heading-xs">{title}</Heading>
        {message && <p className="max-w-sm text-paragraph-sm text-muted-foreground">{message}</p>}
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </div>
  );
}
