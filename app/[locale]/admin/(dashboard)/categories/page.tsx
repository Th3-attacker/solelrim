import { getTranslations } from "next-intl/server";
import { Tags } from "lucide-react";
import { getCategoriesForAdmin } from "@/lib/queries/categories";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { CreateCategoryButton } from "@/components/categories/create-category-button";
import { RenameCategoryDialog } from "@/components/categories/rename-category-dialog";
import { DeleteCategoryButton } from "@/components/categories/delete-category-button";
import { MoveCategoryButtons } from "@/components/categories/move-category-buttons";
import { StateMessage } from "@/components/ui/state-message";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminCategoriesPage() {
  const [t, tCommon, { admin, productType }] = await Promise.all([
    getTranslations("categories"),
    getTranslations("common"),
    requireAdminScope(),
  ]);

  const categories = await getCategoriesForAdmin(
    admin.role === "SUPERADMIN" ? undefined : productType,
  );

  // Reordering only ever happens among a category's own scope siblings
  // (see moveCategory) — first/last-in-scope has to be computed against
  // that same grouping, not this flat, possibly multi-scope list's index.
  // The query is already ordered by [position, name], so grouping by scope
  // in that same order reproduces each scope's relative order directly.
  const scopeIds = new Map<string, string[]>();
  for (const category of categories) {
    const scopeKey = category.productType ?? "";
    const ids = scopeIds.get(scopeKey) ?? [];
    ids.push(category.id);
    scopeIds.set(scopeKey, ids);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <CreateCategoryButton />
      </div>

      {categories.length === 0 ? (
        <StateMessage icon={Tags} title={t("noCategories")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("boutique")}</TableHead>
              <TableHead>{t("productCount")}</TableHead>
              <TableHead className="text-end">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              const canManage =
                admin.role === "SUPERADMIN" || category.productType === productType;
              const scopeKey = category.productType ?? "";
              const ids = scopeIds.get(scopeKey) ?? [];
              const scopeIndex = ids.indexOf(category.id);
              return (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.storeType?.label ?? t("generic")}
                  </TableCell>
                  <TableCell>{category._count.products}</TableCell>
                  <TableCell className="text-end">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <MoveCategoryButtons
                          categoryId={category.id}
                          disableUp={scopeIndex <= 0}
                          disableDown={scopeIndex >= ids.length - 1}
                        />
                        <RenameCategoryDialog
                          categoryId={category.id}
                          currentName={category.name}
                        />
                        <DeleteCategoryButton categoryId={category.id} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
