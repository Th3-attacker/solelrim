"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ChevronLeft } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { getDirection } from "@/i18n/routing";
import { cn } from "@/lib/utils";

function HeroNav({ count }: { count: number }) {
  const { api, scrollPrev, canScrollPrev } = useCarousel();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (count <= 1) return null;

  return (
    <div className="absolute bottom-6 start-8 z-10 flex items-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="rounded-full bg-background/80"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
      >
        <ChevronLeft className="rtl:rotate-180" />
      </Button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`${index + 1}`}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === selected ? "w-5 bg-primary" : "w-1.5 bg-foreground/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function HeroCarousel({ children }: { children: React.ReactNode[] }) {
  const locale = useLocale();

  return (
    <Carousel
      opts={{ direction: getDirection(locale), loop: children.length > 1 }}
    >
      <CarouselContent>
        {children.map((child, index) => (
          <CarouselItem key={index}>{child}</CarouselItem>
        ))}
      </CarouselContent>
      <HeroNav count={children.length} />
    </Carousel>
  );
}
