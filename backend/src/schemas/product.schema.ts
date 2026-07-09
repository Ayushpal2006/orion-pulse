import { z } from "zod";

const BaseProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  barcode: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  purchase_price: z.number().int("Purchase price must be an integer").nonnegative("Purchase price cannot be negative"),
  selling_price: z.number().int("Selling price must be an integer").nonnegative("Selling price cannot be negative"),
  stock: z.number().int("Stock must be an integer").nonnegative("Stock cannot be negative"),
  minimum_stock: z.number().int("Minimum stock must be an integer").nonnegative("Minimum stock cannot be negative"),
  gst: z.number().int("GST must be an integer").nonnegative("GST cannot be negative"),
});

export const CreateProductSchema = BaseProductSchema.extend({
  stock: BaseProductSchema.shape.stock.default(0),
  minimum_stock: BaseProductSchema.shape.minimum_stock.default(0),
  gst: BaseProductSchema.shape.gst.default(18),
});

export const UpdateProductSchema = BaseProductSchema.partial();

