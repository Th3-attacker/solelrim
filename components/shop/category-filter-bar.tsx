import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };

export async function CategoryFilterBar({
  basePath,
  categories,
  activeCategoryId,
}: {
  basePath: string;
  categories: Category[];
  activeCategoryId?: string;
}) {
  const t = await getTranslations("shop");

  return (
    <>
      {/* Desktop: breadcrumb */}
      <nav className="hidden flex-wrap items-center gap-2 text-sm md:flex">
        <Link
          href={`${basePath}/products`}
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
              href={{ pathname: `${basePath}/products`, query: { category: category.id } }}
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

      {/* Mobile: divided full-width rows */}
      <div className="flex flex-col md:hidden">
        <Link
          href={`${basePath}/products`}
          className={cn(
            "border-b py-3 text-sm transition-colors",
            !activeCategoryId
              ? "font-medium text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("allCategories")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={{ pathname: `${basePath}/products`, query: { category: category.id } }}
            className={cn(
              "border-b py-3 text-sm transition-colors",
              activeCategoryId === category.id
                ? "font-medium text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>
    </>
  );
}
