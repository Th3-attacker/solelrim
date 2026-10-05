"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { ImageSquare, Trash, Upload } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

// The upload / replace / remove control the boutique's logo and hero image
// share; they differ only in the actions, the label and the preview box.
export function StoreImageUpload({
  label,
  imageUrl,
  upload,
  remove,
  previewClassName,
  previewWidth,
  imageClassName,
}: {
  label: string;
  imageUrl: string | null;
  upload: (formData: FormData) => Promise<{ error?: string }>;
  remove: () => Promise<{ error?: string }>;
  previewClassName: string;
  previewWidth: number;
  imageClassName: string;
}) {
  const tCommon = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.set("file", files[0]);

    startTransition(async () => {
      const result = await upload(formData);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      window.location.reload();
    });
  }

  async function handleRemove() {
    const result = await remove();
    if (result.error) {
      toast.error(tCommon("error"));
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card ${previewClassName}`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              width={previewWidth}
              height={64}
              className={imageClassName}
            />
          ) : (
            <ImageSquare className="size-6 text-muted-foreground" />
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
        {imageUrl && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" size="sm" loading={pending}>
                <Trash className="size-4" />
              </Button>
            }
            title={tCommon("removeImageConfirmTitle")}
            description={tCommon("deleteConfirmBody")}
            confirmLabel={tCommon("delete")}
            destructive
            onConfirm={handleRemove}
          />
        )}
      </div>
    </div>
  );
}
