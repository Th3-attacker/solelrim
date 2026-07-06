"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/product";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
}

export async function createCategory(name: string) {
  await requireAdmin();
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name },
  });

  revalidatePath("/admin/products");
  return { category };
}
