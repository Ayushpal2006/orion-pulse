import { z } from "zod";

export const BaseCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty"),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  total_orders: z.number().int().nonnegative().optional(),
  lifetime_value: z.number().int().nonnegative().optional(),
  last_visit: z.string().optional().nullable(),
});

export const CreateCustomerSchema = BaseCustomerSchema;

export const UpdateCustomerSchema = BaseCustomerSchema.partial();
