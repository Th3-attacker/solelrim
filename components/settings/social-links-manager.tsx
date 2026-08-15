"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  createSocialLink,
  deleteSocialLink,
  moveSocialLink,
} from "@/lib/actions/social-links";

type SocialLink = { id: string; platform: string; url: string };

export function SocialLinksManager({ links }: { links: SocialLink[] }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createSocialLink({ platform, url });
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      setPlatform("");
      setUrl("");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSocialLink(id);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  function handleMove(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveSocialLink(id, direction);
      if (result?.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{t("socialSection")}</span>

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          {links.map((link, index) => (
            <div key={link.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{link.platform}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                >
                  <span className="truncate">{link.url}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                onClick={() => handleMove(link.id, "up")}
                aria-label={tCommon("moveUp")}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending || index === links.length - 1}
                onClick={() => handleMove(link.id, "down")}
                aria-label={tCommon("moveDown")}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => handleDelete(link.id)}
                aria-label={tCommon("delete")}
              >
                <Trash2 className="size-4" />
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
            {t("addSocialLink")}
          </Button>
        }
        title={t("addSocialLink")}
        footer={
          <Button
            type="button"
            disabled={!platform.trim() || !url.trim()}
            loading={pending}
            onClick={handleCreate}
          >
            {tCommon("create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="social-platform">{t("socialPlatform")}</Label>
            <Input
              id="social-platform"
              value={platform}
              placeholder={t("socialPlatformPlaceholder")}
              onChange={(e) => setPlatform(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="social-url">{t("socialUrl")}</Label>
            <Input
              id="social-url"
              value={url}
              placeholder="https://..."
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>
      </ResponsiveFormDialog>
    </div>
  );
}
