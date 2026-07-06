import { z } from "zod";

const emptyToNull = (val: unknown) =>
  val === "" || val === undefined ? null : val;

export const variantSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1),
  color: z.string().min(1),
  sku: z.string().min(1),
  price: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  basePrice: z.coerce.number().positive(),
  compareAtPrice: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
  isFeatured: z.boolean(),
  categoryId: z.string().min(1),
  isActive: z.boolean(),
  variants: z.array(variantSchema).min(1),
});

export type ProductInput = z.infer<typeof productSchema>;
export type VariantInput = z.infer<typeof variantSchema>;

export const categorySchema = z.object({
  name: z.string().min(1),
});
