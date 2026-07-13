import { z } from "zod";

const CheckoutItemSchema = z.object({
  productId: z.number().int("Product ID must be an integer").positive("Product ID must be a positive number"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be greater than 0"),
});

export const CheckoutRequestSchema = z.object({
  customerPhone: z.string().trim().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  paymentMethod: z.string().trim().refine(
    (val) => ["Cash", "UPI", "Card", "Wallet"].includes(val),
    { message: "Payment method must be one of: Cash, UPI, Card, Wallet" }
  ),
  cashierName: z.string().trim().min(1, "Cashier name is required"),
  customerName: z.string().trim().optional(),
  items: z.array(CheckoutItemSchema).min(1, "At least one checkout item is required"),
});
