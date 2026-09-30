"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { requireWritableAdminScope } from "@/lib/shop/admin-scope";
import { sellerInputSchema, sellerQuotaSchema } from "@/lib/validation/seller";

// A boutique admin (or a superadmin scoped to that boutique) creates a
// SELLER in their own boutique — the boutique always comes from the
// caller's scope, never from the request, and a SELLER caller is rejected
// by requireWritableAdminScope itself.
export async function createSeller(input: unknown): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();
  const parsed = sellerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  // Cheap early exit so the common "quota already full" case never creates
  // a Supabase account at all — the locked re-check below is what actually
  // enforces the quota under concurrency.
  const [storeType, sellerCount] = await Promise.all([
    prisma.storeType.findUnique({ where: { key: productType }, select: { sellerQuota: true } }),
    prisma.adminUser.count({ where: { role: "SELLER", productType } }),
  ]);
  if (!storeType || sellerCount >= storeType.sellerQuota) {
    return { error: "quotaReached" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    // Read by proxy.ts to route a seller to the checkout without a DB
    // lookup on every request. Only a service-role client can write it.
    app_metadata: { role: "SELLER" },
  });
  if (error) {
    return { error: error.code === "email_exists" ? "emailExists" : "createFailed" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Row lock on the boutique serializes concurrent creates for it, so
      // two simultaneous requests can't both pass the count below.
      const [row] = await tx.$queryRaw<{ sellerQuota: number }[]>`
        SELECT "sellerQuota" FROM "StoreType" WHERE "key" = ${productType} FOR UPDATE
      `;
      const sellers = await tx.adminUser.count({ where: { role: "SELLER", productType } });
      if (!row || sellers >= row.sellerQuota) {
        throw new Error("quotaReached");
      }
      await tx.adminUser.create({
        data: { supabaseUserId: data.user.id, role: "SELLER", productType },
      });
    });
  } catch (err) {
    // No cross-system transaction between Supabase Auth and Postgres — undo
    // the account so a rejected create never leaves an orphaned login.
    // supabase-js reports failure through `error`, it doesn't throw.
    const { error: rollbackError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (rollbackError) {
      console.error("[createSeller] orphaned auth user", data.user.id, rollbackError);
    }
    if (err instanceof Error && err.message === "quotaReached") {
      return { error: "quotaReached" };
    }
    throw err;
  }

  revalidatePath("/admin/settings");
  return {};
}

export async function deleteSeller(adminUserId: string): Promise<{ error?: string }> {
  const { productType } = await requireWritableAdminScope();

  // Scoped to the caller's boutique and to the SELLER role, so this can
  // never delete another boutique's seller or any admin account.
  const seller = await prisma.adminUser.findFirst({
    where: { id: adminUserId, role: "SELLER", productType },
  });
  if (!seller) {
    return { error: "notFound" };
  }
  // Its till must be closed (by the seller, or by the admin from the
  // session page) first — deleting would leave an open till nobody owns.
  const openSession = await prisma.cashSession.findFirst({
    where: { sellerId: seller.id, status: "OPEN" },
    select: { id: true },
  });
  if (openSession) {
    return { error: "hasOpenSession" };
  }

  // Keep the AdminUser row if the login couldn't be removed, so the admin
  // sees the failure and can retry instead of leaving a live login behind
  // a seller that no longer shows up anywhere. An already-missing auth user
  // is fine to proceed past.
  const { error } = await createAdminClient().auth.admin.deleteUser(seller.supabaseUserId);
  if (error && error.code !== "user_not_found") {
    return { error: "deleteFailed" };
  }
  await prisma.adminUser.delete({ where: { id: seller.id } });

  revalidatePath("/admin/settings");
  return {};
}

export async function setSellerQuota(
  productType: string,
  quota: number,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = sellerQuotaSchema.safeParse(quota);
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const updated = await prisma.storeType.updateMany({
    where: { key: productType },
    data: { sellerQuota: parsed.data },
  });
  if (updated.count === 0) {
    return { error: "notFound" };
  }

  revalidatePath("/admin/settings");
  return {};
}
