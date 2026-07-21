import { IPurchaseRepository } from "../interfaces/IPurchaseRepository";
import { PurchaseOrder, PurchaseItem } from "../../types/purchase.types";
import { db } from "../../db";
import { purchase_orders, purchase_items, suppliers, products } from "../../db/schema";
import { eq, and, desc, asc, like, or, sql, gte, lte } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresPurchaseRepository implements IPurchaseRepository {
  async create(poData: any, itemsData: any[], tx?: any): Promise<PurchaseOrder> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [createdPo] = await client
      .insert(purchase_orders)
      .values({
        store_id: storeId,
        supplier_id: poData.supplier_id,
        purchase_number: poData.purchase_number,
        supplier_invoice_number: poData.supplier_invoice_number || null,
        purchase_date: poData.purchase_date ? new Date(poData.purchase_date) : new Date(),
        subtotal: poData.subtotal,
        discount: poData.discount || 0,
        tax: poData.tax || 0,
        grand_total: poData.grand_total,
        payment_status: poData.payment_status,
        payment_method: poData.payment_method || null,
        notes: poData.notes || null,
      })
      .returning();

    if (!createdPo) {
      throw new Error("Failed to insert purchase order");
    }

    if (itemsData.length > 0) {
      await client.insert(purchase_items).values(
        itemsData.map((item) => ({
          purchase_order_id: createdPo.id,
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price: item.purchase_price,
          selling_price: item.selling_price,
          line_total: item.line_total,
        }))
      );
    }

    return {
      ...createdPo,
      purchase_date: createdPo.purchase_date.toISOString(),
      created_at: createdPo.created_at.toISOString(),
      updated_at: createdPo.updated_at.toISOString(),
    };
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }, tx?: any): Promise<PurchaseOrder[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];

    if (storeId !== undefined) {
      conditions.push(eq(purchase_orders.store_id, storeId));
    }

    if (params?.q) {
      const searchLike = `%${params.q}%`;
      conditions.push(
        or(
          like(purchase_orders.purchase_number, searchLike),
          like(purchase_orders.supplier_invoice_number, searchLike),
          like(suppliers.name, searchLike)
        )
      );
    }

    if (params?.startDate) {
      conditions.push(gte(purchase_orders.purchase_date, new Date(params.startDate)));
    }

    if (params?.endDate) {
      conditions.push(lte(purchase_orders.purchase_date, new Date(params.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        id: purchase_orders.id,
        store_id: purchase_orders.store_id,
        supplier_id: purchase_orders.supplier_id,
        purchase_number: purchase_orders.purchase_number,
        supplier_invoice_number: purchase_orders.supplier_invoice_number,
        purchase_date: purchase_orders.purchase_date,
        subtotal: purchase_orders.subtotal,
        discount: purchase_orders.discount,
        tax: purchase_orders.tax,
        grand_total: purchase_orders.grand_total,
        payment_status: purchase_orders.payment_status,
        payment_method: purchase_orders.payment_method,
        notes: purchase_orders.notes,
        created_at: purchase_orders.created_at,
        updated_at: purchase_orders.updated_at,
        supplier_name: suppliers.name,
      })
      .from(purchase_orders)
      .leftJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
      .where(whereClause)
      .orderBy(desc(purchase_orders.id));

    return rows.map((r: any) => ({
      ...r,
      purchase_date: r.purchase_date.toISOString(),
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    }));
  }

  async getById(id: number, tx?: any): Promise<PurchaseOrder | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(purchase_orders.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(purchase_orders.store_id, storeId)) as any;
    }

    const [po] = await client
      .select({
        id: purchase_orders.id,
        store_id: purchase_orders.store_id,
        supplier_id: purchase_orders.supplier_id,
        purchase_number: purchase_orders.purchase_number,
        supplier_invoice_number: purchase_orders.supplier_invoice_number,
        purchase_date: purchase_orders.purchase_date,
        subtotal: purchase_orders.subtotal,
        discount: purchase_orders.discount,
        tax: purchase_orders.tax,
        grand_total: purchase_orders.grand_total,
        payment_status: purchase_orders.payment_status,
        payment_method: purchase_orders.payment_method,
        notes: purchase_orders.notes,
        created_at: purchase_orders.created_at,
        updated_at: purchase_orders.updated_at,
        supplier_name: suppliers.name,
      })
      .from(purchase_orders)
      .innerJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
      .where(cond)
      .limit(1);

    if (!po) return null;

    return {
      ...po,
      purchase_date: po.purchase_date.toISOString(),
      created_at: po.created_at.toISOString(),
      updated_at: po.updated_at.toISOString(),
    };
  }

  async getItems(purchaseOrderId: number, tx?: any): Promise<PurchaseItem[]> {
    const client = tx || db;
    const rows = await client
      .select({
        id: purchase_items.id,
        purchase_order_id: purchase_items.purchase_order_id,
        product_id: purchase_items.product_id,
        quantity: purchase_items.quantity,
        purchase_price: purchase_items.purchase_price,
        selling_price: purchase_items.selling_price,
        line_total: purchase_items.line_total,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(purchase_items)
      .innerJoin(products, eq(purchase_items.product_id, products.id))
      .where(eq(purchase_items.purchase_order_id, purchaseOrderId));

    return rows;
  }

  async update(id: number, poData: any, tx?: any): Promise<PurchaseOrder | null> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(purchase_orders.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(purchase_orders.store_id, storeId)) as any;
    }

    const [updated] = await client
      .update(purchase_orders)
      .set({
        supplier_id: poData.supplier_id,
        supplier_invoice_number: poData.supplier_invoice_number || null,
        purchase_date: poData.purchase_date ? new Date(poData.purchase_date) : undefined,
        subtotal: poData.subtotal,
        discount: poData.discount || 0,
        tax: poData.tax || 0,
        grand_total: poData.grand_total,
        payment_status: poData.payment_status,
        payment_method: poData.payment_method || null,
        notes: poData.notes || null,
        updated_at: new Date(),
      })
      .where(cond)
      .returning();

    if (!updated) return null;

    return {
      ...updated,
      purchase_date: updated.purchase_date.toISOString(),
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  async delete(id: number, tx?: any): Promise<boolean> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(purchase_orders.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(purchase_orders.store_id, storeId)) as any;
    }

    const [deleted] = await client
      .delete(purchase_orders)
      .where(cond)
      .returning();

    return !!deleted;
  }

  async deleteItems(purchaseOrderId: number, tx?: any): Promise<void> {
    const client = tx || db;
    await client.delete(purchase_items).where(eq(purchase_items.purchase_order_id, purchaseOrderId));
  }

  async insertItems(items: any[], tx?: any): Promise<void> {
    const client = tx || db;
    if (items.length > 0) {
      await client.insert(purchase_items).values(items);
    }
  }
}
