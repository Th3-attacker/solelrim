import { SectionTitle } from "@/components/shop/section-title";
import { Star, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Testimonial = {
  id: string;
  customerName: string;
  quote: string;
  rating: number | null;
  orderId: string | null;
};

// Optional, admin-toggled (StoreType.testimonialsEnabled) — the caller
// already gates on that flag; this only additionally hides itself when
// there's nothing to show yet (enabled but zero entries added).
export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  // Hook avant le retour anticipé (règles des hooks React).
  const t = useTranslations("shop");
  if (testimonials.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>{t("testimonialsTitle")}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
        {testimonials.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
            {item.rating && (
              <div className="flex items-center gap-0.5" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    weight={i < item.rating! ? "fill" : "regular"}
                    className={cn(
                      "size-4",
                      i < item.rating! ? "fill-primary text-primary" : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
            )}
            <p className="text-paragraph-md text-foreground">&ldquo;{item.quote}&rdquo;</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                — {item.customerName}
              </span>
              {item.orderId && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <SealCheck className="size-3.5" weight="fill" />
                  {t("testimonialsVerified")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
