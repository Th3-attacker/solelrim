"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema, type ProductInput } from "@/lib/validation/product";
import { PrismaClientKnownRequestError } from "@/lib/generated/prisma/internal/prismaNamespace";
import { slugify } from "@/lib/shop/slug";
import { requireAdminScope } from "@/lib/shop/admin-scope";
import { detectImageSignature } from "@/lib/shop/image-signature";

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
  const { productType } = await requireAdminScope();
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

  try {
    const slug = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: productId }, data: product });

      const existing = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((v) => v.id));
      const submittedIds = new Set(
        variants.filter((v) => v.id).map((v) => v.id!),
      );

      const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));
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

      return updated.slug;
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
  const { productType } = await requireAdminScope();

  const owned = await prisma.product.findFirst({
    where: { id: productId, productType },
    select: { id: true },
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

  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
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

  const fileBuffer = await file.arrayBuffer();
  const detected = detectImageSignature(new Uint8Array(fileBuffer));
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
