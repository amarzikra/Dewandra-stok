import { z } from "zod";

const MAX_AMOUNT = 999_999_999_999.99;

const amount = z.number().finite().min(0).max(MAX_AMOUNT);
const positiveAmount = z.number().finite().positive().max(MAX_AMOUNT);
const uuid = z.string().uuid();

export const inventoryIdSchema = uuid;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

// PATCH fields may be cleared by sending an empty string.
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Gunakan format tanggal YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Tanggal tidak valid.");

export const movementTypes = [
  "in",
  "out",
  "return_in",
  "return_out",
  "adjustment",
] as const;

export const createProductSchema = z
  .object({
    storeId: uuid,
    name: z.string().trim().min(1).max(160),
    sku: optionalText(60),
    category: optionalText(80),
    unit: z.string().trim().min(1).max(20).default("pcs"),
    purchasePrice: amount.default(0),
    sellingPrice: amount.default(0),
    minStock: amount.default(0),
  })
  .strict();

export const updateProductSchema = z
  .object({
    storeId: uuid.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    sku: clearableText(60),
    category: clearableText(80),
    unit: z.string().trim().min(1).max(20).optional(),
    purchasePrice: amount.optional(),
    sellingPrice: amount.optional(),
    minStock: amount.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.storeId !== undefined ||
      value.name !== undefined ||
      value.sku !== undefined ||
      value.category !== undefined ||
      value.unit !== undefined ||
      value.purchasePrice !== undefined ||
      value.sellingPrice !== undefined ||
      value.minStock !== undefined ||
      value.isActive !== undefined,
    "Sertakan minimal satu perubahan.",
  );

export const listProductsSchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    storeId: uuid.optional(),
    status: z.enum(["low", "out", "ok"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const recordStockMovementSchema = z
  .object({
    type: z.enum(["in", "out"]),
    productId: uuid,
    quantity: positiveAmount,
    movementDate: calendarDate,
    note: z.string().trim().max(500).default(""),
  })
  .strict();

export const listStockMovementsSchema = z
  .object({
    type: z.enum(movementTypes).optional(),
    storeId: uuid.optional(),
    productId: uuid.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const createReturnSchema = z
  .object({
    productId: uuid,
    type: z.enum(["to_supplier", "from_customer"]),
    quantity: positiveAmount,
    reason: z.string().trim().min(1).max(300),
    returnDate: calendarDate,
  })
  .strict();

export const listReturnsSchema = z
  .object({
    storeId: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const createOpnameSchema = z
  .object({
    storeId: uuid,
    opnameDate: calendarDate,
    note: z.string().trim().max(500).default(""),
    items: z
      .array(
        z
          .object({
            productId: uuid,
            physicalQty: amount,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.productId)).size ===
      value.items.length,
    "Barang tidak boleh dicatat dua kali.",
  );

export const listOpnamesSchema = z
  .object({
    storeId: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const reportSchema = z
  .object({
    type: z.enum(["stock", "mutation"]),
    storeId: uuid.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Tanggal awal tidak boleh melewati tanggal akhir.",
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type RecordStockMovementInput = z.infer<
  typeof recordStockMovementSchema
>;
export type ListStockMovementsInput = z.infer<typeof listStockMovementsSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ListReturnsInput = z.infer<typeof listReturnsSchema>;
export type CreateOpnameInput = z.infer<typeof createOpnameSchema>;
export type ListOpnamesInput = z.infer<typeof listOpnamesSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
