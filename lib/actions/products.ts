"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema, type ProductInput } from "@/lib/validation/product";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { slugify } from "@/lib/shop/slug";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { validateImageBytes, MAX_IMAGE_BYTES } from "@/lib/shop/image-signature";
import { logAdminAction } from "@/lib/audit";

const PRODUCT_IMAGES_BUCKET = "product-images";

export type ProductActionResult = { error?: string; productId?: string };

// Slug is generated once at creation and never touched again, so an already
// shared/bookmarked product URL never breaks from a later name edit.
async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug;
}

export async function createProduct(
  input: ProductInput,
): Promise<ProductActionResult> {
  const { productType } = await requireAdminScope();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { variants, ...product } = parsed.data;

  // A category is either shared (productType: null) or scoped to one
  // boutique — same ownership check as promo-codes.ts does for clientId,
  // stopping an admin from attaching a product to another boutique's
  // private category by guessing its id.
  const category = await prisma.category.findFirst({
    where: { id: product.categoryId, OR: [{ productType: null }, { productType }] },
    select: { id: true },
  });
  if (!category) {
    return { error: "invalid" };
  }

  const slug = await generateUniqueSlug(product.name);

  try {
    const created = await prisma.product.create({
      data: {
        ...product,
        slug,
        productType,
        variants: {
          create: variants.map(({ id: _id, ...variant }) => variant),
        },
      },
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { productId: created.id };
  } catch (err) {
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "duplicateSku" };
    }
    throw err;
  }
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
): Promise<ProductActionResult> {
  const { admin, productType } = await requireAdminScope();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { variants, ...product } = parsed.data;

  const owned = await prisma.product.findFirst({
    where: { id: productId, productType },
    select: { id: true },
  });
  if (!owned) {
    return { error: "notFound" };
  }

  const category = await prisma.category.findFirst({
    where: { id: product.categoryId, OR: [{ productType: null }, { productType }] },
    select: { id: true },
  });
  if (!category) {
    return { error: "invalid" };
  }

  const existing = await prisma.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((v) => v.id));
  const submittedIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));

  if (toDelete.length > 0) {
    // Dropping a variant from the form would otherwise hit the DB's foreign
    // key constraint and crash once it has sale/order history — same
    // "can't erase history" rule deleteProduct already enforces, just at
    // the variant level instead of the whole product.
    const referenced = await prisma.productVariant.findFirst({
      where: {
        id: { in: toDelete },
        OR: [{ saleItems: { some: {} } }, { orderItems: { some: {} } }],
      },
      select: { id: true },
    });
    if (referenced) {
      return { error: "variantHasSales" };
    }
  }

  try {
    const slug = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: productId }, data: product });

      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (const variant of variants) {
        const { id, ...data } = variant;
        if (id && existingIds.has(id)) {
          await tx.productVariant.update({ where: { id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId } });
        }
      }

      // Colors are free text on both variants and images, not a shared
      // model — a color renamed or dropped here would otherwise leave any
      // photo tagged with the old string invisibly stuck to it, no longer
      // matching anything in the color picker (admin or storefront). Untag
      // instead of guessing which new color it should follow.
      const remainingColors = [...new Set(variants.map((v) => v.color))];
      await tx.productImage.updateMany({
        where: { productId, color: { not: null, notIn: remainingColors } },
        data: { color: null },
      });

      return updated.slug;
    });

    await logAdminAction({
      adminUserId: admin.id,
      productType,
      action: "product.update",
      targetLabel: product.name,
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/");
    revalidatePath(`/products/${slug}`);
    return { productId };
  } catch (err) {
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "duplicateSku" };
    }
    throw err;
  }
}

export async function deleteProduct(
  productId: string,
): Promise<{ error?: string }> {
  const { admin, productType } = await requireAdminScope();

  const owned = await prisma.product.findFirst({
    where: { id: productId, productType },
    select: { id: true, name: true },
  });
  if (!owned) {
    return { error: "notFound" };
  }

  const referenced = await prisma.productVariant.findFirst({
    where: {
      productId,
      OR: [{ saleItems: { some: {} } }, { orderItems: { some: {} } }],
    },
    select: { id: true },
  });
  if (referenced) {
    return { error: "hasSales" };
  }

  const images = await prisma.productImage.findMany({
    where: { productId },
    select: { storagePath: true },
  });

  await prisma.product.delete({ where: { id: productId } });

  if (images.length > 0) {
    const supabase = createAdminClient();
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove(images.map((i) => i.storagePath));
  }

  await logAdminAction({
    adminUserId: admin.id,
    productType,
    action: "product.delete",
    targetLabel: owned.name,
  });

  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
}

// Just an updateMany scoped by productType — activating/deactivating
// never touches sale/order history, so there's nothing to block here the
// way bulkDeleteProducts has to.
export async function bulkSetProductsActive(
  productIds: string[],
  isActive: boolean,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();
  await prisma.product.updateMany({
    where: { id: { in: productIds }, productType },
    data: { isActive },
  });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
}

// Runs deleteProduct per id rather than reimplementing its ownership/
// sales-history/image-cleanup logic — a mixed selection (some deletable,
// some not) is expected, not an error: whatever's blocked just gets
// skipped and counted, the rest still goes through.
export async function bulkDeleteProducts(
  productIds: string[],
): Promise<{ deletedCount: number; skippedCount: number }> {
  let deletedCount = 0;
  let skippedCount = 0;
  for (const id of productIds) {
    const result = await deleteProduct(id);
    if (result.error) {
      skippedCount++;
    } else {
      deletedCount++;
    }
  }
  return { deletedCount, skippedCount };
}

export async function uploadProductImage(
  productId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const owned = await prisma.product.findFirst({
    where: { id: productId, productType },
    select: { id: true, slug: true },
  });
  if (!owned) {
    return { error: "notFound" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "invalid" };
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return { error: "invalidFile" };
  }

  const fileBuffer = await file.arrayBuffer();
  const detected = validateImageBytes(new Uint8Array(fileBuffer));
  if (!detected) {
    return { error: "invalidFile" };
  }
  const storagePath = `products/${productId}/${crypto.randomUUID()}.${detected.extension}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: detected.contentType,
    });

  if (uploadError) {
    return { error: "uploadFailed" };
  }

  const maxPosition = await prisma.productImage.aggregate({
    where: { productId },
    _max: { position: true },
  });

  await prisma.productImage.create({
    data: {
      productId,
      storagePath,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/products/${owned.slug}`);
  return {};
}

export async function deleteProductImage(
  imageId: string,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { slug: true, productType: true } } },
  });
  if (!image || image.product.productType !== productType) {
    return { error: "notFound" };
  }

  const supabase = createAdminClient();
  await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([image.storagePath]);
  await prisma.productImage.delete({ where: { id: imageId } });

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath(`/products/${image.product.slug}`);
  return {};
}

export async function updateProductImageColor(
  imageId: string,
  color: string | null,
): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { slug: true, productType: true } } },
  });
  if (!image || image.product.productType !== productType) {
    return { error: "notFound" };
  }

  await prisma.productImage.update({
    where: { id: imageId },
    data: { color },
  });

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath(`/products/${image.product.slug}`);
  return {};
}
