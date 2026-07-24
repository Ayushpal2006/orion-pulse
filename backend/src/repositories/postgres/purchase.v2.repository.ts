import { db } from "../../db";
import { purchase_orders, purchase_items, suppliers, products } from "../../db/schema";
import { eq, and, desc, or, like, gte, lte } from "drizzle-orm";
import { getStoreId } from "../../db/context";

function toISOStringSafe(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapPurchaseRow(r: any): any {
  const invoiceDateStr = toISOStringSafe(r.invoice_date || r.purchase_date);
  const createdAtStr = toISOStringSafe(r.created_at);
  const updatedAtStr = toISOStringSafe(r.updated_at);
  const poNum = r.po_number || r.purchase_number || "";
  const invNum = r.invoice_number || r.supplier_invoice_number || null;
  const gstVal = r.gst !== undefined ? r.gst : (r.tax || 0);

  return {
    ...r,
    po_number: poNum,
    purchase_number: poNum, // Frontend backward compatibility
    invoice_number: invNum,
    supplier_invoice_number: invNum, // Frontend backward compatibility
    invoice_date: invoiceDateStr,
    purchase_date: invoiceDateStr, // Frontend backward compatibility
    gst: gstVal,
    tax: gstVal, // Frontend backward compatibility
    created_at: createdAtStr,
    updated_at: updatedAtStr,
  };
}

export class PostgresPurchaseV2Repository {
  async create(poData: any, itemsData: any[], tx?: any): Promise<any> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const poNum = poData.po_number || poData.purchase_number;
    const invNum = poData.invoice_number || poData.supplier_invoice_number || null;
    const invDate = poData.invoice_date || poData.purchase_date;
    const gstAmount = poData.gst !== undefined ? poData.gst : (poData.tax || 0);

    const [createdPo] = await client
      .insert(purchase_orders)
      .values({
        store_id: storeId,
        supplier_id: poData.supplier_id,
        po_number: poNum,
        status: poData.status || "COMPLETED",
        expected_delivery: poData.expected_delivery ? new Date(poData.expected_delivery) : null,
        subtotal: poData.subtotal,
        discount: poData.discount || 0,
        gst: gstAmount,
        grand_total: poData.grand_total,
        invoice_number: invNum,
        invoice_date: invDate ? new Date(invDate) : new Date(),
        transport_charges: poData.transport_charges || 0,
        other_charges: poData.other_charges || 0,
        net_amount: poData.net_amount || poData.grand_total,
        payment_status: poData.payment_status || "Pending",
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
          received_quantity: item.received_quantity || item.quantity,
          purchase_price: item.purchase_price,
          discount: item.discount || 0,
          gst: item.gst || 0,
          line_total: item.line_total,
        }))
      );
    }

    return mapPurchaseRow(createdPo);
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }, tx?: any): Promise<any[]> {
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
          like(purchase_orders.po_number, searchLike),
          like(purchase_orders.invoice_number, searchLike),
          like(suppliers.company_name, searchLike)
        )
      );
    }

    if (params?.startDate) {
      conditions.push(gte(purchase_orders.invoice_date, new Date(params.startDate)));
    }

    if (params?.endDate) {
      conditions.push(lte(purchase_orders.invoice_date, new Date(params.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        id: purchase_orders.id,
        store_id: purchase_orders.store_id,
        supplier_id: purchase_orders.supplier_id,
        po_number: purchase_orders.po_number,
        status: purchase_orders.status,
        expected_delivery: purchase_orders.expected_delivery,
        subtotal: purchase_orders.subtotal,
        discount: purchase_orders.discount,
        gst: purchase_orders.gst,
        grand_total: purchase_orders.grand_total,
        invoice_number: purchase_orders.invoice_number,
        invoice_date: purchase_orders.invoice_date,
        transport_charges: purchase_orders.transport_charges,
        other_charges: purchase_orders.other_charges,
        net_amount: purchase_orders.net_amount,
        payment_status: purchase_orders.payment_status,
        notes: purchase_orders.notes,
        created_at: purchase_orders.created_at,
        updated_at: purchase_orders.updated_at,
        supplier_name: suppliers.company_name,
      })
      .from(purchase_orders)
      .leftJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
      .where(whereClause)
      .orderBy(desc(purchase_orders.id));

    return rows.map((r: any) => mapPurchaseRow(r));
  }

  async getById(id: number, tx?: any): Promise<any | null> {
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
        po_number: purchase_orders.po_number,
        status: purchase_orders.status,
        expected_delivery: purchase_orders.expected_delivery,
        subtotal: purchase_orders.subtotal,
        discount: purchase_orders.discount,
        gst: purchase_orders.gst,
        grand_total: purchase_orders.grand_total,
        invoice_number: purchase_orders.invoice_number,
        invoice_date: purchase_orders.invoice_date,
        transport_charges: purchase_orders.transport_charges,
        other_charges: purchase_orders.other_charges,
        net_amount: purchase_orders.net_amount,
        payment_status: purchase_orders.payment_status,
        notes: purchase_orders.notes,
        created_at: purchase_orders.created_at,
        updated_at: purchase_orders.updated_at,
        supplier_name: suppliers.company_name,
      })
      .from(purchase_orders)
      .leftJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
      .where(cond)
      .limit(1);

    if (!po) return null;

    return mapPurchaseRow(po);
  }

  async getItems(purchaseOrderId: number, tx?: any): Promise<any[]> {
    const client = tx || db;
    const rows = await client
      .select({
        id: purchase_items.id,
        purchase_order_id: purchase_items.purchase_order_id,
        product_id: purchase_items.product_id,
        quantity: purchase_items.quantity,
        received_quantity: purchase_items.received_quantity,
        purchase_price: purchase_items.purchase_price,
        discount: purchase_items.discount,
        gst: purchase_items.gst,
        line_total: purchase_items.line_total,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(purchase_items)
      .innerJoin(products, eq(purchase_items.product_id, products.id))
      .where(eq(purchase_items.purchase_order_id, purchaseOrderId));

    return rows.map((r: any) => ({
      ...r,
      selling_price: r.purchase_price,
    }));
  }

  async update(id: number, poData: any, tx?: any): Promise<any | null> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(purchase_orders.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(purchase_orders.store_id, storeId)) as any;
    }

    const invNum = poData.invoice_number || poData.supplier_invoice_number || undefined;
    const invDate = poData.invoice_date || poData.purchase_date;
    const gstAmount = poData.gst !== undefined ? poData.gst : poData.tax;

    const [updated] = await client
      .update(purchase_orders)
      .set({
        supplier_id: poData.supplier_id,
        po_number: poData.po_number || poData.purchase_number || undefined,
        invoice_number: invNum !== undefined ? invNum : undefined,
        invoice_date: invDate ? new Date(invDate) : undefined,
        subtotal: poData.subtotal,
        discount: poData.discount !== undefined ? poData.discount : undefined,
        gst: gstAmount !== undefined ? gstAmount : undefined,
        grand_total: poData.grand_total,
        payment_status: poData.payment_status || "Pending",
        notes: poData.notes !== undefined ? poData.notes : undefined,
        updated_at: new Date(),
      })
      .where(cond)
      .returning();

    if (!updated) return null;

    return mapPurchaseRow(updated);
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
      await client.insert(purchase_items).values(
        items.map((item) => ({
          purchase_order_id: item.purchase_order_id,
          product_id: item.product_id,
          quantity: item.quantity,
          received_quantity: item.received_quantity || item.quantity,
          purchase_price: item.purchase_price,
          discount: item.discount || 0,
          gst: item.gst || 0,
          line_total: item.line_total,
        }))
      );
    }
  }
}

export const purchaseV2Repository = new PostgresPurchaseV2Repository();
