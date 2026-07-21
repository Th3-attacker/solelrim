"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string };

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  return (
    <div
      className={cn(
        "grid gap-3",
        images.length > 1 ? "grid-cols-[auto_1fr]" : "grid-cols-1",
      )}
    >
      {images.length > 1 && (
        <div className="flex flex-col gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`${index + 1}`}
              aria-current={index === selected}
              className={cn(
                "relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-inset transition-all",
                index === selected
                  ? "ring-2 ring-foreground"
                  : "ring-border hover:ring-foreground/40",
              )}
            >
              <Image src={image.url} alt="" fill className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {current ? (
          <Image
            src={current.url}
            alt={productName}
            fill
            className="object-contain p-6"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Solelrim
          </div>
        )}
      </div>
    </div>
  );
}
