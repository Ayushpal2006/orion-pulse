import { db } from "../../db";
import { kots, kot_items, sales, store_kot_sequences } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { IKotRepository } from "../interfaces/kot.repository.interface";
import { KotDTO, KotItemDTO, CreateKotInput } from "../../types/kot.types";

export class KotPostgresRepository implements IKotRepository {
  async getNextKotNumber(storeId: number, txClient?: any): Promise<number> {
    const client = txClient || db;
    
    // Concurrency-safe atomic sequence generation using PostgreSQL ON CONFLICT DO UPDATE RETURNING
    const result = await client.execute(sql`
      INSERT INTO store_kot_sequences (store_id, last_kot_number, updated_at)
      VALUES (${storeId}, 1, NOW())
      ON CONFLICT (store_id)
      DO UPDATE SET 
        last_kot_number = store_kot_sequences.last_kot_number + 1,
        updated_at = NOW()
      RETURNING last_kot_number;
    `);

    const rows = result.rows || result;
    if (rows && rows.length > 0) {
      const num = Number(rows[0].last_kot_number);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }

    // Safe fallback if needed
    return 1;
  }

  async createKot(orgId: number, storeId: number, input: CreateKotInput, txClient?: any): Promise<KotDTO> {
    const client = txClient || db;
    const kotNumber = await this.getNextKotNumber(storeId, client);

    const [createdKot] = await client
      .insert(kots)
      .values({
        organization_id: orgId,
        store_id: storeId,
        sale_id: input.saleId,
        kot_number: kotNumber,
        status: "PENDING",
        table_no: input.tableNo || null,
        order_type: input.orderType || "DINE_IN",
        notes: input.notes || null,
      })
      .returning();

    const createdItems: KotItemDTO[] = [];
    if (input.items && input.items.length > 0) {
      const insertedItems = await client
        .insert(kot_items)
        .values(
          input.items.map((item) => ({
            organization_id: orgId,
            store_id: storeId,
            kot_id: createdKot.id,
            product_id: item.productId,
            quantity: item.quantity,
            product_name_snapshot: item.productName,
            notes: item.notes || null,
          }))
        )
        .returning();

      for (const item of insertedItems) {
        createdItems.push({
          id: item.id,
          kotId: item.kot_id,
          productId: item.product_id,
          productName: item.product_name_snapshot,
          quantity: item.quantity,
          notes: item.notes,
          createdAt: item.created_at ? item.created_at.toISOString() : new Date().toISOString(),
        });
      }
    }

    return {
      id: createdKot.id,
      organizationId: createdKot.organization_id,
      storeId: createdKot.store_id,
      saleId: createdKot.sale_id,
      kotNumber: createdKot.kot_number,
      status: createdKot.status as any,
      tableNo: createdKot.table_no,
      orderType: createdKot.order_type as any,
      notes: createdKot.notes,
      printedAt: createdKot.printed_at ? createdKot.printed_at.toISOString() : null,
      reprintCount: createdKot.reprint_count,
      createdAt: createdKot.created_at.toISOString(),
      updatedAt: createdKot.updated_at.toISOString(),
      items: createdItems,
    };
  }

  async getById(id: number, storeId: number, orgId?: number): Promise<KotDTO | null> {
    const conditions = [eq(kots.id, id), eq(kots.store_id, storeId)];
    if (orgId) {
      conditions.push(eq(kots.organization_id, orgId));
    }

    const [kotRow] = await db
      .select({
        kot: kots,
        invoiceNumber: sales.invoice_number,
      })
      .from(kots)
      .leftJoin(sales, eq(kots.sale_id, sales.id))
      .where(and(...conditions))
      .limit(1);

    if (!kotRow) return null;

    const itemsRows = await db
      .select()
      .from(kot_items)
      .where(eq(kot_items.kot_id, id));

    return {
      id: kotRow.kot.id,
      organizationId: kotRow.kot.organization_id,
      storeId: kotRow.kot.store_id,
      saleId: kotRow.kot.sale_id,
      kotNumber: kotRow.kot.kot_number,
      status: kotRow.kot.status as any,
      tableNo: kotRow.kot.table_no,
      orderType: kotRow.kot.order_type as any,
      notes: kotRow.kot.notes,
      printedAt: kotRow.kot.printed_at ? kotRow.kot.printed_at.toISOString() : null,
      reprintCount: kotRow.kot.reprint_count,
      createdAt: kotRow.kot.created_at.toISOString(),
      updatedAt: kotRow.kot.updated_at.toISOString(),
      invoiceNumber: kotRow.invoiceNumber || undefined,
      items: itemsRows.map((it) => ({
        id: it.id,
        kotId: it.kot_id,
        productId: it.product_id,
        productName: it.product_name_snapshot,
        quantity: it.quantity,
        notes: it.notes,
        createdAt: it.created_at ? it.created_at.toISOString() : undefined,
      })),
    };
  }

  async getBySaleId(saleId: number, storeId: number, orgId?: number): Promise<KotDTO[]> {
    const conditions = [eq(kots.sale_id, saleId), eq(kots.store_id, storeId)];
    if (orgId) {
      conditions.push(eq(kots.organization_id, orgId));
    }

    const kotRows = await db
      .select({
        kot: kots,
        invoiceNumber: sales.invoice_number,
      })
      .from(kots)
      .leftJoin(sales, eq(kots.sale_id, sales.id))
      .where(and(...conditions))
      .orderBy(desc(kots.id));

    const result: KotDTO[] = [];
    for (const row of kotRows) {
      const itemsRows = await db
        .select()
        .from(kot_items)
        .where(eq(kot_items.kot_id, row.kot.id));

      result.push({
        id: row.kot.id,
        organizationId: row.kot.organization_id,
        storeId: row.kot.store_id,
        saleId: row.kot.sale_id,
        kotNumber: row.kot.kot_number,
        status: row.kot.status as any,
        tableNo: row.kot.table_no,
        orderType: row.kot.order_type as any,
        notes: row.kot.notes,
        printedAt: row.kot.printed_at ? row.kot.printed_at.toISOString() : null,
        reprintCount: row.kot.reprint_count,
        createdAt: row.kot.created_at.toISOString(),
        updatedAt: row.kot.updated_at.toISOString(),
        invoiceNumber: row.invoiceNumber || undefined,
        items: itemsRows.map((it) => ({
          id: it.id,
          kotId: it.kot_id,
          productId: it.product_id,
          productName: it.product_name_snapshot,
          quantity: it.quantity,
          notes: it.notes,
          createdAt: it.created_at ? it.created_at.toISOString() : undefined,
        })),
      });
    }

    return result;
  }

  async getAll(params: { storeId: number; orgId?: number; status?: string; limit?: number; offset?: number }): Promise<KotDTO[]> {
    const conditions = [eq(kots.store_id, params.storeId)];
    if (params.orgId) {
      conditions.push(eq(kots.organization_id, params.orgId));
    }
    if (params.status) {
      conditions.push(eq(kots.status, params.status));
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const kotRows = await db
      .select({
        kot: kots,
        invoiceNumber: sales.invoice_number,
      })
      .from(kots)
      .leftJoin(sales, eq(kots.sale_id, sales.id))
      .where(and(...conditions))
      .orderBy(desc(kots.created_at))
      .limit(limit)
      .offset(offset);

    const result: KotDTO[] = [];
    for (const row of kotRows) {
      const itemsRows = await db
        .select()
        .from(kot_items)
        .where(eq(kot_items.kot_id, row.kot.id));

      result.push({
        id: row.kot.id,
        organizationId: row.kot.organization_id,
        storeId: row.kot.store_id,
        saleId: row.kot.sale_id,
        kotNumber: row.kot.kot_number,
        status: row.kot.status as any,
        tableNo: row.kot.table_no,
        orderType: row.kot.order_type as any,
        notes: row.kot.notes,
        printedAt: row.kot.printed_at ? row.kot.printed_at.toISOString() : null,
        reprintCount: row.kot.reprint_count,
        createdAt: row.kot.created_at.toISOString(),
        updatedAt: row.kot.updated_at.toISOString(),
        invoiceNumber: row.invoiceNumber || undefined,
        items: itemsRows.map((it) => ({
          id: it.id,
          kotId: it.kot_id,
          productId: it.product_id,
          productName: it.product_name_snapshot,
          quantity: it.quantity,
          notes: it.notes,
          createdAt: it.created_at ? it.created_at.toISOString() : undefined,
        })),
      });
    }

    return result;
  }

  async updateStatus(id: number, storeId: number, status: string, orgId?: number): Promise<KotDTO | null> {
    const conditions = [eq(kots.id, id), eq(kots.store_id, storeId)];
    if (orgId) {
      conditions.push(eq(kots.organization_id, orgId));
    }

    const [updated] = await db
      .update(kots)
      .set({
        status,
        updated_at: new Date(),
      })
      .where(and(...conditions))
      .returning();

    if (!updated) return null;
    return this.getById(id, storeId, orgId);
  }

  async recordReprint(id: number, storeId: number, orgId?: number): Promise<KotDTO | null> {
    const conditions = [eq(kots.id, id), eq(kots.store_id, storeId)];
    if (orgId) {
      conditions.push(eq(kots.organization_id, orgId));
    }

    const [updated] = await db
      .update(kots)
      .set({
        reprint_count: sql`${kots.reprint_count} + 1`,
        printed_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(...conditions))
      .returning();

    if (!updated) return null;
    return this.getById(id, storeId, orgId);
  }
}

export const kotRepository = new KotPostgresRepository();
