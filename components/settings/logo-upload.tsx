"use client";

import { useTranslations } from "next-intl";
import { StoreImageUpload } from "@/components/settings/store-image-upload";
import { uploadStoreLogo, removeStoreLogo } from "@/lib/actions/settings";
import { LOGO } from "@/lib/shop/compress-image";

export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const t = useTranslations("settings");

  return (
    <StoreImageUpload
      label={t("logo")}
      imageUrl={logoUrl}
      upload={uploadStoreLogo}
      compression={LOGO}
      remove={removeStoreLogo}
      previewClassName="size-16"
      previewWidth={64}
      imageClassName="size-full object-contain"
    />
  );
}
