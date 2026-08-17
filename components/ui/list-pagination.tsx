import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function ListPagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const t = await getTranslations("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  // A hand-edited or stale `?page=` outside [1, totalPages] (e.g. the list
  // shrank after a delete) would otherwise produce a nonsensical from/to
  // range below — clamp once, use the clamped value everywhere.
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (targetPage > 1) {
      params.set("page", String(targetPage));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {t("paginationRange", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="icon-sm">
            <Link href={hrefFor(currentPage - 1)} aria-label={t("previous")}>
              <ChevronLeft className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" disabled aria-label={t("previous")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        )}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="icon-sm">
            <Link href={hrefFor(currentPage + 1)} aria-label={t("next")}>
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" disabled aria-label={t("next")}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
