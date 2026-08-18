"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { testimonialSchema } from "@/lib/validation/settings";
import { requireAdminScope } from "@/lib/shop/admin-scope";

export async function createTestimonial(input: unknown) {
  const { productType } = await requireAdminScope();
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "invalid" as const };
  }

  const maxPosition = await prisma.testimonial.aggregate({
    where: { productType },
    _max: { position: true },
  });

  const testimonial = await prisma.testimonial.create({
    data: {
      ...parsed.data,
      productType,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { testimonial };
}

export async function deleteTestimonial(id: string) {
  const { productType } = await requireAdminScope();

  const deleted = await prisma.testimonial.deleteMany({ where: { id, productType } });
  if (deleted.count === 0) {
    return { error: "notFound" as const };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function moveTestimonial(id: string, direction: "up" | "down") {
  const { productType } = await requireAdminScope();

  const testimonials = await prisma.testimonial.findMany({
    where: { productType },
    orderBy: { position: "asc" },
  });
  const index = testimonials.findIndex((item) => item.id === id);
  if (index === -1) {
    return { error: "notFound" as const };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= testimonials.length) {
    return {};
  }

  const a = testimonials[index];
  const b = testimonials[swapIndex];
  await prisma.$transaction([
    prisma.testimonial.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.testimonial.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function setTestimonialsEnabled(enabled: boolean): Promise<{ error?: string }> {
  const { productType } = await requireAdminScope();

  await prisma.storeType.update({
    where: { key: productType },
    data: { testimonialsEnabled: enabled },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}
