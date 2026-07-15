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
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href="/"
        className={cn(
          "transition-colors",
          !activeCategoryId
            ? "font-medium text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {t("allCategories")}
      </Link>
      {categories.map((category) => (
        <span key={category.id} className="flex items-center gap-2">
          <span aria-hidden className="text-border">
            /
          </span>
          <Link
            href={{ pathname: "/", query: { category: category.id } }}
            className={cn(
              "transition-colors",
              activeCategoryId === category.id
                ? "font-medium text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {category.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
