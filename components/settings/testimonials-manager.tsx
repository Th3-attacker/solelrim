"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash, CaretUp, CaretDown, Star } from "@phosphor-icons/react/dist/ssr";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  createTestimonial,
  deleteTestimonial,
  moveTestimonial,
  setTestimonialsEnabled,
} from "@/lib/actions/testimonials";
import { cn } from "@/lib/utils";

type Testimonial = {
  id: string;
  customerName: string;
  quote: string;
  rating: number | null;
};

export function TestimonialsManager({
  testimonials,
  enabled,
}: {
  testimonials: Testimonial[];
  enabled: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggleTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createTestimonial({
        customerName,
        quote,
        rating: rating ?? undefined,
      });
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setCustomerName("");
      setQuote("");
      setRating(null);
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTestimonial(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  function handleMove(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveTestimonial(id, direction);
      if (result?.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  function handleToggleEnabled(pressed: boolean) {
    startToggleTransition(async () => {
      const result = await setTestimonialsEnabled(pressed);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("testimonialsSection")}</span>
        <Toggle
          variant="outline"
          size="sm"
          pressed={enabled}
          disabled={togglePending}
          onPressedChange={handleToggleEnabled}
        >
          {enabled ? t("testimonialsEnabledOn") : t("testimonialsEnabledOff")}
        </Toggle>
      </div>
      <p className="text-sm text-muted-foreground">{t("testimonialsSectionHint")}</p>

      {testimonials.length > 0 && (
        <div className="flex flex-col gap-2">
          {testimonials.map((item, index) => (
            <div key={item.id} className="flex items-start gap-2 rounded-md border p-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.customerName}</span>
                  {item.rating && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-3",
                            i < item.rating!
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.quote}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                onClick={() => handleMove(item.id, "up")}
                aria-label={tCommon("moveUp")}
              >
                <CaretUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === testimonials.length - 1}
                onClick={() => handleMove(item.id, "down")}
                aria-label={tCommon("moveDown")}
              >
                <CaretDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(item.id)}
                aria-label={tCommon("delete")}
              >
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" className="self-start">
            <Plus className="size-4" />
            {t("addTestimonial")}
          </Button>
        }
        title={t("addTestimonial")}
        footer={
          <Button
            type="button"
            disabled={!customerName.trim() || !quote.trim()}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="testimonial-name">{t("testimonialCustomerName")}</Label>
            <Input
              id="testimonial-name"
              value={customerName}
              placeholder={t("testimonialCustomerNamePlaceholder")}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="testimonial-quote">{t("testimonialQuote")}</Label>
            <Textarea
              id="testimonial-quote"
              value={quote}
              placeholder={t("testimonialQuotePlaceholder")}
              onChange={(e) => setQuote(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("testimonialRating")}</Label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                const active = rating !== null && value <= rating;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={String(value)}
                    aria-pressed={active}
                    onClick={() => setRating(rating === value ? null : value)}
                  >
                    <Star
                      className={cn(
                        "size-5",
                        active ? "fill-primary text-primary" : "text-muted-foreground/30",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
