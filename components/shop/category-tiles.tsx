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
          >
            <Card className="flex aspect-square items-center justify-center p-4 text-center transition-colors hover:bg-muted/50">
              <span className="text-sm font-medium">{category.name}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
