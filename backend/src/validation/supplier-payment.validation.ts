import { z } from "zod";

const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Card",
  "Other",
] as const;

export const CreateSupplierPaymentSchema = z.object({
  supplier_id: z.number().int().positive("Supplier ID must be a positive integer"),
  amount: z.number().int().positive("Amount must be a positive integer in paise"),
  payment_method: z.enum(PAYMENT_METHODS),
  reference_number: z.string().trim().optional().nullable().or(z.literal("")),
  notes: z.string().trim().optional().nullable().or(z.literal("")),
  payment_date: z.string().datetime({ message: "Invalid payment date format" }).optional().or(z.literal("")),
});
