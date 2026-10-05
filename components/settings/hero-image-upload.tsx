"use client";

import { useTranslations } from "next-intl";
import { StoreImageUpload } from "@/components/settings/store-image-upload";
import { uploadStoreHeroImage, removeStoreHeroImage } from "@/lib/actions/settings";

export function HeroImageUpload({ heroImageUrl }: { heroImageUrl: string | null }) {
  const t = useTranslations("settings");

  return (
    <StoreImageUpload
      label={t("heroImage")}
      imageUrl={heroImageUrl}
      upload={uploadStoreHeroImage}
      remove={removeStoreHeroImage}
      previewClassName="h-16 w-28"
      previewWidth={112}
      imageClassName="size-full object-cover"
    />
  );
}
