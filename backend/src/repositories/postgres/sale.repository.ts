import { ISaleRepository } from "../interfaces/ISaleRepository";
import { Sale } from "../../types/checkout.types";
import { db } from "../../db";
import { sales, sale_items, products, customers } from "../../db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresSaleRepository implements ISaleRepository {
  async getAll(tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .orderBy(desc(sales.id));

    return rows.map((r: any) => ({
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    }));
  }

  async getById(id: number, tx?: any): Promise<Sale | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(sales.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    };
  }

  async getByInvoice(invoice: string, tx?: any): Promise<Sale | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(sales.invoice_number, invoice);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    };
  }

  async getTodaySales(tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = sql`timezone('Asia/Kolkata', ${sales.created_at})::date = timezone('Asia/Kolkata', now())::date`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .orderBy(desc(sales.id));

    return rows.map((r: any) => ({
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    }));
  }

  async getSaleItems(saleId: number, tx?: any): Promise<any[]> {
    const client = tx || db;
    // Note: sale_id constraint automatically maps to a sale record in this store,
    // so we don't strictly need store_id filter here.
    const rows = await client
      .select({
        id: sale_items.id,
        sale_id: sale_items.sale_id,
        product_id: sale_items.product_id,
        quantity: sale_items.quantity,
        selling_price: sale_items.selling_price,
        discount: sale_items.discount,
        line_total: sale_items.line_total,
        product_name: products.name,
        product_sku: products.sku,
        product_gst: products.gst,
      })
      .from(sale_items)
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(eq(sale_items.sale_id, saleId))
      .orderBy(sale_items.id);
    return rows;
  }

  async getByCustomerPhone(phone: string, tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(customers.phone, phone);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        id: sales.id,
        invoice_number: sales.invoice_number,
        customer_id: sales.customer_id,
        cashier_name: sales.cashier_name,
        payment_method: sales.payment_method,
        subtotal: sales.subtotal,
        discount: sales.discount,
        gst: sales.gst,
        grand_total: sales.grand_total,
        public_token: sales.public_token,
        pdf_url: sales.pdf_url,
        shared_at: sales.shared_at,
        created_at: sales.created_at,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customer_id, customers.id))
      .where(cond)
      .orderBy(desc(sales.id));

    return rows.map((r: any) => ({
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    }));
  }

  async getLastInvoiceNumber(tx?: any): Promise<string | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({ invoice_number: sales.invoice_number })
      .from(sales)
      .where(cond)
      .orderBy(desc(sales.id))
      .limit(1);

    return rows[0]?.invoice_number || null;
  }

  async updatePdfUrlByInvoice(invoiceNumber: string, pdfUrl: string, tx?: any): Promise<boolean> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(sales.invoice_number, invoiceNumber);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const result = await client
      .update(sales)
      .set({ pdf_url: pdfUrl })
      .where(cond);

    return result.rowCount > 0;
  }

  async getByPublicToken(token: string, tx?: any): Promise<Sale | null> {
    const client = tx || db;
    // public_token is globally unique and public, so no store_id context is required.
    const rows = await client
      .select()
      .from(sales)
      .where(eq(sales.public_token, token))
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      public_token: r.public_token ?? undefined,
      pdf_url: r.pdf_url ?? undefined,
      shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
      created_at: r.created_at.toISOString()
    };
  }

  async searchSales(
    params: {
      invoiceNumber?: string;
      customerName?: string;
      phone?: string;
      date?: string;
      cashier?: string;
      paymentMethod?: string;
      startDate?: string;
      endDate?: string;
    },
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    if (params.invoiceNumber) {
      cond = and(cond, like(sales.invoice_number, `%${params.invoiceNumber}%`)) as any;
    }
    if (params.cashier) {
      cond = and(cond, like(sales.cashier_name, `%${params.cashier}%`)) as any;
    }
    if (params.paymentMethod) {
      cond = and(cond, eq(sales.payment_method, params.paymentMethod)) as any;
    }
    if (params.date) {
      cond = and(cond, sql`timezone('Asia/Kolkata', ${sales.created_at})::date = ${params.date}::date`) as any;
    }
    if (params.startDate) {
      const end = params.endDate || params.startDate;
      cond = and(
        cond,
        sql`timezone('Asia/Kolkata', ${sales.created_at})::date >= ${params.startDate}::date AND timezone('Asia/Kolkata', ${sales.created_at})::date <= ${end}::date`
      ) as any;
    }

    let queryBuilder = client
      .select({
        id: sales.id,
        invoice_number: sales.invoice_number,
        customer_id: sales.customer_id,
        cashier_name: sales.cashier_name,
        payment_method: sales.payment_method,
        subtotal: sales.subtotal,
        discount: sales.discount,
        gst: sales.gst,
        grand_total: sales.grand_total,
        paid_amount: sales.paid_amount,
        balance: sales.balance,
        public_token: sales.public_token,
        pdf_url: sales.pdf_url,
        shared_at: sales.shared_at,
        created_at: sales.created_at,
        customer_name: customers.name,
        customer_phone: customers.phone,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id));

    if (params.customerName) {
      cond = and(cond, like(customers.name, `%${params.customerName}%`)) as any;
    }
    if (params.phone) {
      cond = and(cond, like(customers.phone, `%${params.phone}%`)) as any;
    }

    const rows = await queryBuilder.where(cond).orderBy(desc(sales.id));
    return rows;
  }

  async getSalesExport(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    switch (filter) {
      case "today":
        cond = and(cond, sql`timezone('Asia/Kolkata', ${sales.created_at})::date = timezone('Asia/Kolkata', now())::date`) as any;
        break;
      case "yesterday":
        cond = and(cond, sql`timezone('Asia/Kolkata', ${sales.created_at})::date = (timezone('Asia/Kolkata', now()) - interval '1 day')::date`) as any;
        break;
      case "last7":
        cond = and(cond, sql`timezone('Asia/Kolkata', ${sales.created_at})::date >= (timezone('Asia/Kolkata', now()) - interval '6 days')::date`) as any;
        break;
      case "last30":
        cond = and(cond, sql`timezone('Asia/Kolkata', ${sales.created_at})::date >= (timezone('Asia/Kolkata', now()) - interval '29 days')::date`) as any;
        break;
      case "thisMonth":
        cond = and(cond, sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM')`) as any;
        break;
      case "lastMonth":
        cond = and(cond, sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()) - interval '1 month', 'YYYY-MM')`) as any;
        break;
      case "thisYear":
        cond = and(cond, sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'YYYY') = to_char(timezone('Asia/Kolkata', now()), 'YYYY')`) as any;
        break;
      case "custom":
        if (startDate) {
          const actualEnd = endDate || startDate;
          cond = and(
            cond,
            sql`timezone('Asia/Kolkata', ${sales.created_at})::date >= ${startDate}::date AND timezone('Asia/Kolkata', ${sales.created_at})::date <= ${actualEnd}::date`
          ) as any;
        }
        break;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .orderBy(desc(sales.id));

    return rows.map((r: any) => ({
      Invoice: r.invoice_number,
      Date: r.created_at,
      Cashier: r.cashier_name,
      Payment: r.payment_method,
      Subtotal: r.subtotal / 100.0,
      Discount: r.discount / 100.0,
      GST: r.gst / 100.0,
      Total: r.grand_total / 100.0,
      PublicToken: r.public_token,
    }));
  }
}
