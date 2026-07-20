import { z } from "zod";

export const BaseSupplierSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty"),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const CreateSupplierSchema = BaseSupplierSchema;

export const UpdateSupplierSchema = BaseSupplierSchema.partial();
