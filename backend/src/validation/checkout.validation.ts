import { z } from "zod";

const CheckoutItemSchema = z.object({
  productId: z.number().int("Product ID must be an integer").positive("Product ID must be a positive number"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be greater than 0"),
  unitPrice: z.number().optional(),
  price: z.number().optional(),
  discount: z.number().optional(),
  discountPercent: z.number().optional(),
});

export const CheckoutRequestSchema = z.object({
  customerPhone: z.string().trim().optional().nullable(),
  customerName: z.string().trim().optional().nullable(),
  customerId: z.number().optional().nullable(),
  paymentMethod: z.string().trim().optional().default("Cash"),
  cashierName: z.string().trim().optional().nullable(),
  items: z.array(CheckoutItemSchema).min(1, "At least one checkout item is required"),
  subtotal: z.number().optional(),
  discount: z.number().optional(),
  discountPercent: z.number().optional(),
  cartDiscount: z.number().optional(),
  gst: z.number().optional(),
  grandTotal: z.number().optional(),
  paidAmount: z.number().optional(),
  balance: z.number().optional(),
  paymentDetails: z.any().optional(),
});
