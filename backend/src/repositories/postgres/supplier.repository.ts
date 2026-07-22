import { ISupplierRepository } from "../interfaces/ISupplierRepository";
import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from "../../types/supplier.types";
import { db } from "../../db";
import { suppliers } from "../../db/schema";
import { eq, and, desc, asc, like, or, sql } from "drizzle-orm";
import { getStoreId } from "../../db/context";

function mapSupplierRow(r: any): Supplier {
  return {
    ...r,
    name: r.company_name,
    gstin: r.gst_number,
    is_archived: r.is_active === 0 ? 1 : 0,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export class PostgresSupplierRepository implements ISupplierRepository {
  async getAll(params?: { q?: string; sort?: string; includeArchived?: boolean }, tx?: any): Promise<Supplier[]> {
    const client = tx || db;
    const storeId = getStoreId();
    
    const conditions: any[] = [];
    const includeArchived = params?.includeArchived ?? false;

    if (!includeArchived) {
      conditions.push(eq(suppliers.is_active, 1));
    }

    if (storeId !== undefined) {
      conditions.push(eq(suppliers.store_id, storeId));
    }

    if (params?.q) {
      const likeQuery = `%${params.q}%`;
      conditions.push(
        or(
          like(suppliers.company_name, likeQuery),
          like(suppliers.phone, likeQuery),
          like(suppliers.gst_number, likeQuery),
          like(suppliers.supplier_code, likeQuery)
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
      query.orderBy(asc(suppliers.company_name));
    } else {
      query.orderBy(desc(suppliers.id));
    }

    const rows = await query;

    return rows.map(mapSupplierRow);
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
    return mapSupplierRow(rows[0]);
  }

  async create(supplier: CreateSupplierDTO, tx?: any): Promise<Supplier> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const companyName = supplier.company_name || supplier.name || "Supplier";
    const supplierCode = supplier.supplier_code || `SUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const gstNumber = supplier.gst_number ?? supplier.gstin ?? null;
    const isActive = supplier.is_active ?? (supplier.is_archived ? 0 : 1);

    const [created] = await client
      .insert(suppliers)
      .values({
        store_id: storeId,
        supplier_code: supplierCode,
        company_name: companyName,
        contact_person: supplier.contact_person ?? null,
        phone: supplier.phone ?? null,
        email: supplier.email ?? null,
        gst_number: gstNumber,
        pan_number: supplier.pan_number ?? null,
        address: supplier.address ?? null,
        city: supplier.city ?? null,
        state: supplier.state ?? null,
        country: supplier.country ?? null,
        postal_code: supplier.postal_code ?? null,
        opening_balance: supplier.opening_balance ?? 0,
        current_balance: supplier.current_balance ?? 0,
        payment_terms: supplier.payment_terms ?? null,
        credit_limit: supplier.credit_limit ?? 0,
        is_active: isActive,
        notes: supplier.notes ?? null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to retrieve created supplier");
    }
    return mapSupplierRow(created);
  }

  async update(id: number, supplier: UpdateSupplierDTO, tx?: any): Promise<Supplier | null> {
    const client = tx || db;
    const storeId = getStoreId();

    const updateData: any = {};
    if (supplier.company_name !== undefined || supplier.name !== undefined) {
      updateData.company_name = supplier.company_name || supplier.name;
    }
    if (supplier.gst_number !== undefined || supplier.gstin !== undefined) {
      updateData.gst_number = supplier.gst_number ?? supplier.gstin;
    }
    if (supplier.is_active !== undefined) {
      updateData.is_active = supplier.is_active;
    } else if (supplier.is_archived !== undefined) {
      updateData.is_active = supplier.is_archived ? 0 : 1;
    }
    if (supplier.supplier_code !== undefined) updateData.supplier_code = supplier.supplier_code;
    if (supplier.contact_person !== undefined) updateData.contact_person = supplier.contact_person;
    if (supplier.phone !== undefined) updateData.phone = supplier.phone;
    if (supplier.email !== undefined) updateData.email = supplier.email;
    if (supplier.pan_number !== undefined) updateData.pan_number = supplier.pan_number;
    if (supplier.address !== undefined) updateData.address = supplier.address;
    if (supplier.city !== undefined) updateData.city = supplier.city;
    if (supplier.state !== undefined) updateData.state = supplier.state;
    if (supplier.country !== undefined) updateData.country = supplier.country;
    if (supplier.postal_code !== undefined) updateData.postal_code = supplier.postal_code;
    if (supplier.opening_balance !== undefined) updateData.opening_balance = supplier.opening_balance;
    if (supplier.current_balance !== undefined) updateData.current_balance = supplier.current_balance;
    if (supplier.payment_terms !== undefined) updateData.payment_terms = supplier.payment_terms;
    if (supplier.credit_limit !== undefined) updateData.credit_limit = supplier.credit_limit;
    if (supplier.notes !== undefined) updateData.notes = supplier.notes;

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

    return mapSupplierRow(updated);
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
        is_active: 0,
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
