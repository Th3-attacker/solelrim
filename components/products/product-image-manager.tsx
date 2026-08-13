"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { X, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { uploadProductImage, deleteProductImage } from "@/lib/actions/products";

type ProductImage = { id: string; storagePath: string };

export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(images);

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.set("file", files[0]);

    startTransition(async () => {
      const result = await uploadProductImage(productId, formData);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProductImage(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((image) => (
          <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
            <Image
              src={getProductImageUrl(image.storagePath)}
              alt=""
              fill
              className="object-cover"
              sizes="25vw"
            />
            <button
              type="button"
              onClick={() => handleDelete(image.id)}
              disabled={pending}
              aria-label={tCommon("delete")}
              className="absolute top-1 end-1 rounded-full bg-background/90 p-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
            >
              {pending ? <Spinner className="size-3" /> : <X className="size-3" />}
            </button>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={pending}
        onClick={() => inputRef.current?.click()}
        className="w-fit"
      >
        <Upload className="size-4" />
        {t("images")}
      </Button>
    </div>
  );
}
