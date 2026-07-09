import { Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";

type Category = { id: string; name: string };

export async function CategoryTiles({ categories }: { categories: Category[] }) {
  const t = await getTranslations("shop");

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">
        {t("shopByCategory")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={{ pathname: "/", query: { category: category.id } }}
            className="group"
          >
            <Card className="flex aspect-square flex-col items-center justify-center gap-3 border-transparent bg-linear-to-br from-primary/10 to-muted p-4 text-center transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-md">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Tag className="size-5" />
              </div>
              <span className="text-sm font-medium">{category.name}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
