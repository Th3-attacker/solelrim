import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };

export async function CategoryFilterBar({
  categories,
  activeCategoryId,
}: {
  categories: Category[];
  activeCategoryId?: string;
}) {
  const t = await getTranslations("shop");

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/"
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors",
          !activeCategoryId
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        {t("allCategories")}
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={{ pathname: "/", query: { category: category.id } }}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            activeCategoryId === category.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}
