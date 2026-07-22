import { z } from "zod";

export const RawSupplierObjectSchema = z.object({
  company_name: z.string().trim().optional().nullable(),
  name: z.string().trim().optional().nullable(),
  supplier_code: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
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
  gst_number: z.string().trim().optional().nullable().or(z.literal("").transform(() => null)),
  gstin: z.string().trim().optional().nullable().or(z.literal("").transform(() => null)),
  pan_number: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  postal_code: z.string().trim().optional().nullable(),
  opening_balance: z.number().int().optional(),
  current_balance: z.number().int().optional(),
  payment_terms: z.string().trim().optional().nullable(),
  credit_limit: z.number().int().optional(),
  is_active: z.number().int().optional(),
  is_archived: z.number().int().optional(),
  notes: z.string().trim().optional().nullable(),
});

export const BaseSupplierSchema = RawSupplierObjectSchema.refine(
  (data) => {
    const hasName = (data.company_name && data.company_name.trim().length > 0) || (data.name && data.name.trim().length > 0);
    return hasName;
  },
  {
    message: "Supplier name cannot be empty",
    path: ["company_name"],
  }
);

export const CreateSupplierSchema = BaseSupplierSchema;

export const UpdateSupplierSchema = RawSupplierObjectSchema.partial().refine(
  (data) => {
    if (data.company_name !== undefined || data.name !== undefined) {
      const hasName = (data.company_name && data.company_name.trim().length > 0) || (data.name && data.name.trim().length > 0);
      return hasName;
    }
    return true;
  },
  {
    message: "Supplier name cannot be empty",
    path: ["company_name"],
  }
);
