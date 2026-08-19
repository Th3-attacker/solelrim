import { SectionTitle } from "@/components/shop/section-title";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

type Testimonial = {
  id: string;
  customerName: string;
  quote: string;
  rating: number | null;
};

// Optional, admin-toggled (StoreType.testimonialsEnabled) — the caller
// already gates on that flag; this only additionally hides itself when
// there's nothing to show yet (enabled but zero entries added).
export async function TestimonialsSection({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  if (testimonials.length === 0) return null;
  const t = await getTranslations("shop");

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>{t("testimonialsTitle")}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
        {testimonials.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl bg-muted p-6"
          >
            {item.rating && (
              <div className="flex items-center gap-0.5" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-4",
                      i < item.rating!
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
            )}
            <p className="text-paragraph-md text-foreground">
              &ldquo;{item.quote}&rdquo;
            </p>
            <span className="text-sm font-medium text-muted-foreground">
              — {item.customerName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
