import { useTranslations } from "next-intl";

const TICKS = Array.from({ length: 8 });

export function PageSpinner() {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <svg
        role="status"
        aria-label={t("loading")}
        viewBox="0 0 24 24"
        className="size-8 animate-spin text-muted-foreground"
      >
        {TICKS.map((_, i) => (
          <rect
            key={i}
            x="10.5"
            y="1"
            width="3"
            height="7"
            rx="1.5"
            fill="currentColor"
            opacity={1 - i * 0.11}
            transform={`rotate(${i * 45} 12 12)`}
          />
        ))}
      </svg>
    </div>
  );
}
