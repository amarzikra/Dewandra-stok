import { z } from "zod";

// Better Auth account IDs are opaque strings, not UUIDs.
export const accountIdSchema = z.string().min(1).max(128);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

export const createStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(20),
    address: optionalText(200),
    phone: optionalText(30),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(20).optional(),
    address: clearableText(200),
    phone: clearableText(30),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.code !== undefined ||
      value.address !== undefined ||
      value.phone !== undefined ||
      value.isActive !== undefined,
    "Sertakan minimal satu perubahan.",
  );

export const setUserAccessSchema = z
  .object({
    access: z
      .array(
        z
          .object({
            storeId: z.string().uuid(),
            accessLevel: z.enum(["view", "edit"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.access.map((entry) => entry.storeId)).size ===
      value.access.length,
    "Toko tidak boleh dicatat dua kali.",
  );

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(160).optional(),
  })
  .strict()
  .refine(
    (value) => value.name !== undefined || value.email !== undefined,
    "Sertakan minimal satu perubahan.",
  );

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type SetUserAccessInput = z.infer<typeof setUserAccessSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
