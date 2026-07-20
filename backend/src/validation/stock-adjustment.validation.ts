import { z } from "zod";

const ADJUSTMENT_TYPES = [
  "OPENING_STOCK",
  "PHYSICAL_COUNT",
  "DAMAGED",
  "LOST",
  "FOUND",
  "MANUAL_CORRECTION",
  "SAMPLE",
  "RETURN_FROM_CUSTOMER",
] as const;

export const CreateStockAdjustmentSchema = z.object({
  product_id: z.number().int().positive("Product ID must be a positive integer"),
  adjustment_type: z.enum(ADJUSTMENT_TYPES),
  quantity_change: z.number().int().optional(),
  actual_count: z.number().int().nonnegative("Actual count must be a non-negative integer").optional(),
  reason: z.string().trim().min(1, "Reason is required"),
  notes: z.string().trim().optional().nullable().or(z.literal("")),
}).refine((data) => {
  // Either quantity_change or actual_count must be present
  if (data.adjustment_type === "PHYSICAL_COUNT") {
    return data.actual_count !== undefined || data.quantity_change !== undefined;
  }
  return data.quantity_change !== undefined;
}, {
  message: "Either quantity_change or actual_count is required",
  path: ["quantity_change"],
});
