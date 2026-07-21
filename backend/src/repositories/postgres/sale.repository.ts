import { ISaleRepository } from "../interfaces/ISaleRepository";
import { Sale } from "../../types/checkout.types";
import { db } from "../../db";
import { sales, sale_items, products, customers } from "../../db/schema";
import { eq, and, desc, sql, like, gte, lte, ne, or } from "drizzle-orm";
import { getStoreId } from "../../db/context";
import { getUtcBoundariesForFilter } from "../../utils/datetime";

export class PostgresSaleRepository implements ISaleRepository {
  async getAll(tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select()
      .from(sales)
      .where(whereClause)
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
    const conditions: any[] = [eq(sales.id, id)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const [sale] = await client
      .select()
      .from(sales)
      .where(and(...conditions))
      .limit(1);

    if (!sale) return null;

    return {
      ...sale,
      public_token: sale.public_token ?? undefined,
      pdf_url: sale.pdf_url ?? undefined,
      shared_at: sale.shared_at ? sale.shared_at.toISOString() : undefined,
      created_at: sale.created_at.toISOString(),
      voided_at: sale.voided_at ? sale.voided_at.toISOString() : undefined
    };
  }

  async getByInvoice(invoice: string, tx?: any): Promise<Sale | null> {
    return this.getByInvoiceNumber(invoice, tx);
  }

  async getByInvoiceNumber(invoiceNumber: string, tx?: any): Promise<Sale | null> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [eq(sales.invoice_number, invoiceNumber)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const [sale] = await client
      .select()
      .from(sales)
      .where(and(...conditions))
      .limit(1);

    if (!sale) return null;

    return {
      ...sale,
      public_token: sale.public_token ?? undefined,
      pdf_url: sale.pdf_url ?? undefined,
      shared_at: sale.shared_at ? sale.shared_at.toISOString() : undefined,
      created_at: sale.created_at.toISOString(),
      voided_at: sale.voided_at ? sale.voided_at.toISOString() : undefined
    };
  }

  async getTodaySales(tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const { start, end } = getUtcBoundariesForFilter("today");
    const conditions: any[] = [gte(sales.created_at, start), lte(sales.created_at, end)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const rows = await client
      .select()
      .from(sales)
      .where(and(...conditions))
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

  async getByCustomerPhone(phone: string, tx?: any): Promise<Sale[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [like(customers.phone, `%${phone}%`)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const rows = await client
      .select({
        id: sales.id,
        store_id: sales.store_id,
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
        status: sales.status,
        void_reason: sales.void_reason,
        voided_by: sales.voided_by,
        voided_at: sales.voided_at,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(and(...conditions))
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

  async getByPublicToken(token: string, tx?: any): Promise<Sale | null> {
    const client = tx || db;
    const [sale] = await client
      .select()
      .from(sales)
      .where(eq(sales.public_token, token))
      .limit(1);

    if (!sale) return null;

    return {
      ...sale,
      public_token: sale.public_token ?? undefined,
      pdf_url: sale.pdf_url ?? undefined,
      shared_at: sale.shared_at ? sale.shared_at.toISOString() : undefined,
      created_at: sale.created_at.toISOString(),
      voided_at: sale.voided_at ? sale.voided_at.toISOString() : undefined
    };
  }

  async create(saleData: any, items: any[], tx?: any): Promise<Sale> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [createdSale] = await client
      .insert(sales)
      .values({
        store_id: storeId,
        invoice_number: saleData.invoice_number,
        customer_id: saleData.customer_id || null,
        cashier_name: saleData.cashier_name || "Admin",
        payment_method: saleData.payment_method || "Cash",
        subtotal: saleData.subtotal,
        discount: saleData.discount || 0,
        gst: saleData.gst || 0,
        grand_total: saleData.grand_total,
        paid_amount: saleData.paid_amount || saleData.grand_totalPaise || saleData.grand_total,
        balance: saleData.balance || 0,
        public_token: saleData.public_token || null,
        pdf_url: saleData.pdf_url || null,
        status: saleData.status || "COMPLETED",
      })
      .returning();

    if (!createdSale) {
      throw new Error("Failed to insert sale record");
    }

    if (items && items.length > 0) {
      const itemsToInsert = items.map((item) => ({
        sale_id: createdSale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        selling_price: item.selling_price || item.unit_price || 0,
        discount: item.discount || 0,
        line_total: item.line_total,
      }));

      await client.insert(sale_items).values(itemsToInsert);
    }

    return {
      ...createdSale,
      public_token: createdSale.public_token ?? undefined,
      pdf_url: createdSale.pdf_url ?? undefined,
      shared_at: createdSale.shared_at ? createdSale.shared_at.toISOString() : undefined,
      created_at: createdSale.created_at.toISOString(),
      voided_at: createdSale.voided_at ? createdSale.voided_at.toISOString() : undefined
    };
  }

  async getSaleItems(saleId: number, tx?: any): Promise<any[]> {
    return this.getItems(saleId, tx);
  }

  async getItems(saleId: number, tx?: any): Promise<any[]> {
    const client = tx || db;
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
      })
      .from(sale_items)
      .leftJoin(products, eq(sale_items.product_id, products.id))
      .where(eq(sale_items.sale_id, saleId));

    return rows;
  }

  async getLastInvoiceNumber(tx?: any): Promise<string | null> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({ invoice_number: sales.invoice_number })
      .from(sales)
      .where(whereClause)
      .orderBy(desc(sales.id))
      .limit(1);

    return rows[0]?.invoice_number || null;
  }

  async updatePdfUrlByInvoice(invoiceNumber: string, pdfUrl: string, tx?: any): Promise<boolean> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [eq(sales.invoice_number, invoiceNumber)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const [updated] = await client
      .update(sales)
      .set({ pdf_url: pdfUrl })
      .where(and(...conditions))
      .returning();

    return !!updated;
  }

  async updatePublicToken(id: number, token: string, tx?: any): Promise<boolean> {
    const client = tx || db;
    const [updated] = await client
      .update(sales)
      .set({ public_token: token, shared_at: new Date() })
      .where(eq(sales.id, id))
      .returning();

    return !!updated;
  }

  async voidSale(id: number, reason: string, voidedBy: string, tx?: any): Promise<Sale> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [eq(sales.id, id)];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const [updated] = await client
      .update(sales)
      .set({
        status: "VOID",
        void_reason: reason,
        voided_by: voidedBy,
        voided_at: new Date(),
      })
      .where(and(...conditions))
      .returning();

    if (!updated) {
      throw new Error(`Sale with ID ${id} not found`);
    }

    return {
      ...updated,
      public_token: updated.public_token ?? undefined,
      pdf_url: updated.pdf_url ?? undefined,
      shared_at: updated.shared_at ? updated.shared_at.toISOString() : undefined,
      created_at: updated.created_at.toISOString(),
      voided_at: updated.voided_at ? updated.voided_at.toISOString() : undefined,
    };
  }

  async searchSales(
    params: {
      invoiceNumber?: string;
      cashier?: string;
      customerName?: string;
      phone?: string;
      date?: string;
      paymentMethod?: string;
      startDate?: string;
      endDate?: string;
    },
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];

    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    if (params.invoiceNumber) {
      conditions.push(like(sales.invoice_number, `%${params.invoiceNumber}%`));
    }
    if (params.cashier) {
      conditions.push(like(sales.cashier_name, `%${params.cashier}%`));
    }
    if (params.paymentMethod) {
      conditions.push(eq(sales.payment_method, params.paymentMethod));
    }
    if (params.date) {
      const { start, end } = getUtcBoundariesForFilter("custom", params.date, params.date);
      conditions.push(gte(sales.created_at, start), lte(sales.created_at, end));
    }
    if (params.startDate) {
      const endLimit = params.endDate || params.startDate;
      const { start, end } = getUtcBoundariesForFilter("custom", params.startDate, endLimit);
      conditions.push(gte(sales.created_at, start), lte(sales.created_at, end));
    }

    if (params.customerName) {
      conditions.push(like(customers.name, `%${params.customerName}%`));
    }
    if (params.phone) {
      conditions.push(like(customers.phone, `%${params.phone}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(whereClause)
      .orderBy(desc(sales.id));

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
    const conditions: any[] = [];

    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    if (params.invoiceNumber) {
      conditions.push(like(sales.invoice_number, `%${params.invoiceNumber}%`));
    }
    if (params.customerId) {
      conditions.push(eq(sales.customer_id, params.customerId));
    }
    if (params.paymentMethod) {
      conditions.push(eq(sales.payment_method, params.paymentMethod));
    }
    if (params.status && params.status !== "ALL" && params.status !== "all") {
      conditions.push(eq(sales.status, params.status));
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          like(sales.invoice_number, searchPattern),
          like(customers.name, searchPattern),
          like(customers.phone, searchPattern),
          like(sales.payment_method, searchPattern),
          like(sales.status, searchPattern)
        )
      );
    }

    if (params.dateFilter && params.dateFilter !== "all" && params.dateFilter !== "ALL") {
      const { start, end } = getUtcBoundariesForFilter(params.dateFilter, params.startDate, params.endDate);
      conditions.push(gte(sales.created_at, start), lte(sales.created_at, end));
    } else if (params.startDate) {
      const endLimit = params.endDate || params.startDate;
      const { start, end } = getUtcBoundariesForFilter("custom", params.startDate, endLimit);
      conditions.push(gte(sales.created_at, start), lte(sales.created_at, end));
    }

    if (params.customerName) {
      conditions.push(like(customers.name, `%${params.customerName}%`));
    }
    if (params.phone) {
      conditions.push(like(customers.phone, `%${params.phone}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Total count
    const [countResult] = await client
      .select({ count: sql<number>`count(distinct ${sales.id})` })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // 2. Fetch page
    const pageNum = Math.max(1, params.page || 1);
    const limitNum = Math.min(100, Math.max(1, params.limit || 10));
    const offsetNum = (pageNum - 1) * limitNum;

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
      .where(whereClause)
      .orderBy(desc(sales.id))
      .limit(limitNum)
      .offset(offsetNum);

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
    const conditions: any[] = [];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }

    const { start, end } = getUtcBoundariesForFilter(filter, startDate, endDate);
    conditions.push(gte(sales.created_at, start), lte(sales.created_at, end));

    if (!showVoid) {
      conditions.push(ne(sales.status, "VOID"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select()
      .from(sales)
      .where(whereClause)
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
