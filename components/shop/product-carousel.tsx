"use client";

import { useLocale } from "next-intl";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { getDirection } from "@/i18n/routing";

export function ProductCarousel({ children }: { children: React.ReactNode[] }) {
  const locale = useLocale();

  return (
    <Carousel
      opts={{ direction: getDirection(locale), align: "start" }}
      className="px-1"
    >
      <CarouselContent>
        {children.map((child, index) => (
          <CarouselItem key={index} className="basis-1/2 sm:basis-1/3 lg:basis-1/4">
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
