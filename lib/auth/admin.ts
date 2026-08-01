import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { AdminUser } from "@/lib/generated/prisma/client";

// Every admin-gated Server Action and page ultimately calls this. Throws
// "unauthorized" for anyone without a Supabase session AND a matching
// AdminUser row — there are no customer accounts in this app, so any
// Supabase user without one is not a recognized admin.
export async function getCurrentAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const admin = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });
  if (!admin) throw new Error("unauthorized");

  return admin;
}

export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (admin.role !== "SUPERADMIN") throw new Error("forbidden");
  return admin;
}

// Page-only convenience: turns "no access" into the same notFound() every
// scoped detail page already falls back to, instead of a raw thrown error.
export async function requireSuperAdminPage(): Promise<AdminUser> {
  try {
    return await requireSuperAdmin();
  } catch {
    notFound();
  }
}
