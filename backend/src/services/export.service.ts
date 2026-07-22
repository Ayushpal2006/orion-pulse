import * as XLSX from "xlsx";
import { db } from "../db";
import { products, suppliers, purchase_orders, sales, expenses, expense_categories } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";

export class ExportService {
  async exportProductsToExcel(): Promise<Buffer> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.is_active, 1), eq(products.store_id, storeId)))
      .orderBy(desc(products.id));

    const sheetData = rows.map((r) => ({
      ID: r.id,
      SKU: r.sku,
      Barcode: r.barcode || "N/A",
      Name: r.name,
      Category: r.category || "General",
      "Purchase Price (INR)": r.purchase_price / 100.0,
      "Selling Price (INR)": r.selling_price / 100.0,
      "Average Cost (INR)": r.average_cost / 100.0,
      "Last Purchase Cost (INR)": r.last_purchase_cost / 100.0,
      "Margin (%)": r.margin_percent,
      "Markup (%)": r.markup_percent,
      Stock: r.stock,
      "Minimum Stock (Reorder Alert)": r.minimum_stock,
      "Reorder Quantity": r.reorder_quantity,
      "GST (%)": r.gst,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Products Inventory");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
  }

  async exportSuppliersToExcel(): Promise<Buffer> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.is_active, 1), eq(suppliers.store_id, storeId)))
      .orderBy(desc(suppliers.id));

    const sheetData = rows.map((r) => ({
      ID: r.id,
      Name: r.company_name,
      Phone: r.phone || "",
      Email: r.email || "",
      GSTIN: r.gst_number || "",
      Address: r.address || "",
      Notes: r.notes || "",
      "Created At": r.created_at.toISOString(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
  }

  async exportSalesToExcel(): Promise<Buffer> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select()
      .from(sales)
      .where(eq(sales.store_id, storeId))
      .orderBy(desc(sales.id));

    const sheetData = rows.map((r) => ({
      ID: r.id,
      Invoice: r.invoice_number,
      Date: r.created_at.toISOString(),
      Cashier: r.cashier_name || "Admin",
      "Payment Method": r.payment_method,
      "Subtotal (INR)": r.subtotal / 100.0,
      "Discount (INR)": r.discount / 100.0,
      "GST (INR)": r.gst / 100.0,
      "Grand Total (INR)": r.grand_total / 100.0,
      "Paid Amount (INR)": r.paid_amount / 100.0,
      "Balance (INR)": r.balance / 100.0,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
  }

  async exportExpensesToExcel(): Promise<Buffer> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        payment_method: expenses.payment_method,
        vendor: expenses.vendor,
        description: expenses.description,
        date: expenses.date,
        category: expense_categories.name,
      })
      .from(expenses)
      .innerJoin(expense_categories, eq(expenses.category_id, expense_categories.id))
      .where(eq(expenses.store_id, storeId))
      .orderBy(desc(expenses.date));

    const sheetData = rows.map((r: any) => ({
      ID: r.id,
      Date: r.date.toISOString(),
      Category: r.category,
      "Amount (INR)": r.amount / 100.0,
      "Payment Method": r.payment_method,
      Vendor: r.vendor || "",
      Description: r.description || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Expenses Report");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
  }
}
