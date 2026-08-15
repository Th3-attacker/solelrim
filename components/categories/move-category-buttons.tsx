"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { moveCategory } from "@/lib/actions/categories";

export function MoveCategoryButtons({
  categoryId,
  disableUp,
  disableDown,
}: {
  categoryId: string;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveCategory(categoryId, direction);
      if (result.error) {
        toast.error(tCommon("error"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || disableUp}
        onClick={() => handleMove("up")}
        aria-label={tCommon("moveUp")}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || disableDown}
        onClick={() => handleMove("down")}
        aria-label={tCommon("moveDown")}
      >
        <ChevronDown className="size-4" />
      </Button>
    </>
  );
}
