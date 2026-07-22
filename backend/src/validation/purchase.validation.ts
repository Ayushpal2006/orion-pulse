import { z } from "zod";

const parseOptionalNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

const parseRequiredNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const num = Number(val);
  return isNaN(num) ? val : num;
};

const CreatePurchaseItemSchema = z.object({
  product_id: z.preprocess(parseRequiredNumber, z.number().int().positive("Product ID must be a positive integer")),
  quantity: z.preprocess(parseRequiredNumber, z.number().int().positive("Quantity must be a positive integer greater than 0")),
  purchase_price: z.preprocess(parseRequiredNumber, z.number().nonnegative("Purchase price must be greater than or equal to 0")),
  selling_price: z.preprocess(parseOptionalNumber, z.number().nonnegative("Selling price must be greater than or equal to 0").optional()),
  discount: z.preprocess(parseOptionalNumber, z.number().nonnegative().optional()),
  gst: z.preprocess(parseOptionalNumber, z.number().nonnegative().optional()),
});

export const CreatePurchaseSchema = z.object({
  supplier_id: z.preprocess(parseRequiredNumber, z.number().int().positive("Supplier ID must be a positive integer")),
  po_number: z.string().trim().optional().nullable().or(z.literal("")),
  purchase_number: z.string().trim().optional().nullable().or(z.literal("")),
  invoice_number: z.string().trim().optional().nullable().or(z.literal("")),
  supplier_invoice_number: z.string().trim().optional().nullable().or(z.literal("")),
  invoice_date: z.string().optional().nullable().or(z.literal("")),
  purchase_date: z.string().optional().nullable().or(z.literal("")),
  discount: z.preprocess(parseOptionalNumber, z.number().nonnegative("Discount must be greater than or equal to 0").optional()),
  gst: z.preprocess(parseOptionalNumber, z.number().nonnegative("GST must be greater than or equal to 0").optional()),
  tax: z.preprocess(parseOptionalNumber, z.number().nonnegative("Tax must be greater than or equal to 0").optional()),
  payment_status: z.enum(["Pending", "Paid", "Partially Paid"]),
  payment_method: z.string().trim().optional().nullable().or(z.literal("")),
  notes: z.string().trim().optional().nullable().or(z.literal("")),
  items: z.array(CreatePurchaseItemSchema).min(1, "Purchase must contain at least one item"),
});

export const UpdatePurchaseSchema = CreatePurchaseSchema.partial();
