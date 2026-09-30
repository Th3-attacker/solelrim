import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

// Emails live in Supabase Auth, not AdminUser (same reason as
// listBoutiqueAdmins). A boutique only ever has a handful of sellers, so a
// per-user lookup is cheaper and more correct than paging through every
// Auth user.
export async function listSellers(productType: string) {
  const [storeType, sellers] = await Promise.all([
    prisma.storeType.findUniqueOrThrow({
      where: { key: productType },
      select: { sellerQuota: true },
    }),
    prisma.adminUser.findMany({
      where: { role: "SELLER", productType },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const supabase = createAdminClient();
  const users = await Promise.all(
    sellers.map((seller) => supabase.auth.admin.getUserById(seller.supabaseUserId)),
  );

  return {
    quota: storeType.sellerQuota,
    sellers: sellers.map((seller, index) => ({
      id: seller.id,
      email: users[index].data.user?.email ?? null,
      createdAt: seller.createdAt,
    })),
  };
}
