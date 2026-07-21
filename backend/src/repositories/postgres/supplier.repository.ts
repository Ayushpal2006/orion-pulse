import { ISupplierRepository } from "../interfaces/ISupplierRepository";
import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from "../../types/supplier.types";
import { db } from "../../db";
import { suppliers } from "../../db/schema";
import { eq, and, desc, asc, like, or, sql } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresSupplierRepository implements ISupplierRepository {
  async getAll(params?: { q?: string; sort?: string; includeArchived?: boolean }, tx?: any): Promise<Supplier[]> {
    const client = tx || db;
    const storeId = getStoreId();
    
    const conditions: any[] = [];
    const includeArchived = params?.includeArchived ?? false;

    if (!includeArchived) {
      conditions.push(eq(suppliers.is_archived, 0));
    }

    if (storeId !== undefined) {
      conditions.push(eq(suppliers.store_id, storeId));
    }

    if (params?.q) {
      const likeQuery = `%${params.q}%`;
      conditions.push(
        or(
          like(suppliers.name, likeQuery),
          like(suppliers.phone, likeQuery),
          like(suppliers.gstin, likeQuery)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const query = client.select().from(suppliers).where(whereClause);

    // Apply sorting
    const sortField = params?.sort || "newest";
    if (sortField === "newest") {
      query.orderBy(desc(suppliers.id));
    } else if (sortField === "oldest") {
      query.orderBy(asc(suppliers.id));
    } else if (sortField === "alphabetical") {
      query.orderBy(asc(suppliers.name));
    } else {
      query.orderBy(desc(suppliers.id));
    }

    const rows = await query;

    return rows.map((r: any) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    }));
  }

  async getById(id: number, tx?: any): Promise<Supplier | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(suppliers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(suppliers.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(suppliers)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async create(supplier: CreateSupplierDTO, tx?: any): Promise<Supplier> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [created] = await client
      .insert(suppliers)
      .values({
        store_id: storeId,
        name: supplier.name,
        phone: supplier.phone ?? null,
        email: supplier.email ?? null,
        gstin: supplier.gstin ?? null,
        address: supplier.address ?? null,
        notes: supplier.notes ?? null,
        is_archived: supplier.is_archived ?? 0,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to retrieve created supplier");
    }
    return {
      ...created,
      created_at: created.created_at.toISOString(),
      updated_at: created.updated_at.toISOString()
    };
  }

  async update(id: number, supplier: UpdateSupplierDTO, tx?: any): Promise<Supplier | null> {
    const client = tx || db;
    const storeId = getStoreId();

    const updateData: any = {};
    for (const [key, value] of Object.entries(supplier)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getById(id, client);
    }

    updateData.updated_at = new Date();

    let cond = eq(suppliers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(suppliers.store_id, storeId)) as any;
    }

    const [updated] = await client
      .update(suppliers)
      .set(updateData)
      .where(cond)
      .returning();

    if (!updated) return null;

    return {
      ...updated,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString()
    };
  }

  async delete(id: number, tx?: any): Promise<boolean> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(suppliers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(suppliers.store_id, storeId)) as any;
    }

    const [updated] = await client
      .update(suppliers)
      .set({
        is_archived: 1,
        updated_at: new Date(),
      })
      .where(cond)
      .returning();

    return !!updated;
  }

  async search(query: string, tx?: any): Promise<Supplier[]> {
    return this.getAll({ q: query }, tx);
  }
}
