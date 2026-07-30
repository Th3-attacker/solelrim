"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { uploadStoreHeroImage, removeStoreHeroImage } from "@/lib/actions/settings";

export function HeroImageUpload({ heroImageUrl }: { heroImageUrl: string | null }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.set("file", files[0]);

    startTransition(async () => {
      const result = await uploadStoreHeroImage(formData);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeStoreHeroImage();
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("heroImage")}</span>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt=""
              width={112}
              height={64}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
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
        >
          <Upload className="size-4" />
          {tCommon("edit")}
        </Button>
        {heroImageUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={handleRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
