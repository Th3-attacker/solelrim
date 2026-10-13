import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ExpectedError } from "@/lib/errors";
import type { AdminUser } from "@/lib/generated/prisma/client";

// Every admin-gated Server Action and page ultimately calls this. Throws
// "unauthorized" for anyone without a Supabase session AND a matching
// AdminUser row — there are no customer accounts in this app, so any
// Supabase user without one is not a recognized admin. Once per request: a
// page's layout, its gates and getAdminScope all ask.
export const getCurrentAdmin = cache(async (): Promise<AdminUser> => {
  const user = await getSessionUser();
  if (!user) throw new ExpectedError("unauthorized");

  const admin = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });
  if (!admin) throw new ExpectedError("unauthorized");

  return admin;
});

// Per request: the audit log needs the same user's email right after the
// gate resolved them, and getUser() is a round trip to Supabase Auth.
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (admin.role !== "SUPERADMIN") throw new ExpectedError("forbidden");
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
