"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SCOPE_COOKIE } from "@/lib/shop/admin-scope";
import { requireSuperAdmin } from "@/lib/auth/admin";

// A boutique admin has no legitimate reason to call this — they're
// permanently locked to their assigned boutique (see admin-scope.ts's
// getAdminScope()), the cookie this sets is never even consulted for them.
export async function setAdminScope(key: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const storeType = await prisma.storeType.findUnique({ where: { key } });
  if (!storeType) {
    return { error: "invalid" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SCOPE_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  return {};
}
