import { ISaleRepository } from "../interfaces/ISaleRepository";
import { Sale } from "../../types/checkout.types";
import { db } from "../../db";
import { sales, sale_items, products, customers } from "../../db/schema";
import { eq, and, desc, sql, like, gte, lte, ne } from "drizzle-orm";
import { getStoreId } from "../../db/context";
import { getUtcBoundariesForFilter } from "../../utils/datetime";

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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined
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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined
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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined
    };
  }

  async getTodaySales(tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const { start, end } = getUtcBoundariesForFilter("today");
    let cond = and(gte(sales.created_at, start), lte(sales.created_at, end)) as any;
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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined
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
        status: sales.status,
        void_reason: sales.void_reason,
        voided_by: sales.voided_by,
        voided_at: sales.voided_at,
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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined,
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
      created_at: r.created_at.toISOString(),
      voided_at: r.voided_at ? r.voided_at.toISOString() : undefined
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
      const { start, end } = getUtcBoundariesForFilter("custom", params.date, params.date);
      cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;
    }
    if (params.startDate) {
      const endLimit = params.endDate || params.startDate;
      const { start, end } = getUtcBoundariesForFilter("custom", params.startDate, endLimit);
      cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;
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
        status: sales.status,
        void_reason: sales.void_reason,
        voided_by: sales.voided_by,
        voided_at: sales.voided_at,
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

  async searchSalesPaginated(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      invoiceNumber?: string;
      customerName?: string;
      phone?: string;
      customerId?: number;
      paymentMethod?: string;
      status?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      dateFilter?: string;
      sort?: string;
    },
    tx?: any
  ): Promise<{ sales: any[]; totalCount: number }> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    if (params.invoiceNumber) {
      cond = and(cond, like(sales.invoice_number, `%${params.invoiceNumber}%`)) as any;
    }
    if (params.customerId) {
      cond = and(cond, eq(sales.customer_id, params.customerId)) as any;
    }
    if (params.paymentMethod) {
      cond = and(cond, eq(sales.payment_method, params.paymentMethod)) as any;
    }
    if (params.status && params.status !== "ALL" && params.status !== "all") {
      cond = and(cond, eq(sales.status, params.status)) as any;
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      const orCond = sql`(${sales.invoice_number} LIKE ${searchPattern} OR ${customers.name} LIKE ${searchPattern} OR ${customers.phone} LIKE ${searchPattern} OR ${sales.payment_method} LIKE ${searchPattern} OR ${sales.status} LIKE ${searchPattern})`;
      cond = and(cond, orCond) as any;
    }

    if (params.dateFilter && params.dateFilter !== "all" && params.dateFilter !== "ALL") {
      const { start, end } = getUtcBoundariesForFilter(params.dateFilter, params.startDate, params.endDate);
      cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;
    } else {
      if (params.date) {
        const { start, end } = getUtcBoundariesForFilter("custom", params.date, params.date);
        cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;
      }
      if (params.startDate) {
        const endLimit = params.endDate || params.startDate;
        const { start, end } = getUtcBoundariesForFilter("custom", params.startDate, endLimit);
        cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;
      }
    }

    if (params.customerName) {
      cond = and(cond, like(customers.name, `%${params.customerName}%`)) as any;
    }
    if (params.phone) {
      cond = and(cond, like(customers.phone, `%${params.phone}%`)) as any;
    }

    const countRows = await client
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(cond);
    const totalCount = Number(countRows[0]?.count || 0);

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
        status: sales.status,
        void_reason: sales.void_reason,
        voided_by: sales.voided_by,
        voided_at: sales.voided_at,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(cond);

    const sortOption = params.sort || "newest";
    if (sortOption === "newest") {
      queryBuilder = queryBuilder.orderBy(desc(sales.created_at), desc(sales.id));
    } else if (sortOption === "oldest") {
      queryBuilder = queryBuilder.orderBy(sales.created_at, sales.id);
    } else if (sortOption === "highest_amount") {
      queryBuilder = queryBuilder.orderBy(desc(sales.grand_total), desc(sales.id));
    } else if (sortOption === "lowest_amount") {
      queryBuilder = queryBuilder.orderBy(sales.grand_total, sales.id);
    } else {
      queryBuilder = queryBuilder.orderBy(desc(sales.id));
    }

    const pageNum = params.page || 1;
    const limitNum = params.limit || 20;
    const offsetNum = (pageNum - 1) * limitNum;

    const rows = await queryBuilder.limit(limitNum).offset(offsetNum);

    return {
      sales: rows.map((r: any) => ({
        ...r,
        public_token: r.public_token ?? undefined,
        pdf_url: r.pdf_url ?? undefined,
        shared_at: r.shared_at ? r.shared_at.toISOString() : undefined,
        created_at: r.created_at.toISOString(),
        voided_at: r.voided_at ? r.voided_at.toISOString() : undefined,
      })),
      totalCount,
    };
  }


  async getSalesExport(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid: boolean = false,
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = sql`1=1`;
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const { start, end } = getUtcBoundariesForFilter(filter, startDate, endDate);
    cond = and(cond, gte(sales.created_at, start), lte(sales.created_at, end)) as any;

    if (!showVoid) {
      cond = and(cond, ne(sales.status, "VOID")) as any;
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
      Status: r.status,
      VoidReason: r.void_reason ?? "",
      VoidedBy: r.voided_by ?? "",
      VoidedAt: r.voided_at ? r.voided_at.toISOString() : "",
    }));
  }
}
