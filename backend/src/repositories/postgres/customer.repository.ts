import { ICustomerRepository } from "../interfaces/ICustomerRepository";
import { Customer, CreateCustomerDTO, UpdateCustomerDTO } from "../../types/customer.types";
import { db } from "../../db";
import { customers, sales } from "../../db/schema";
import { eq, and, desc, like, or } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresCustomerRepository implements ICustomerRepository {
  async getAll(tx?: any): Promise<Customer[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(customers.is_active, 1);
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(customers)
      .where(cond)
      .orderBy(desc(customers.id));

    return rows.map((r: any) => ({
      ...r,
      last_visit: r.last_visit ? r.last_visit.toISOString() : null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    }));
  }

  async getById(id: number, tx?: any): Promise<Customer | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(customers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(customers)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      last_visit: r.last_visit ? r.last_visit.toISOString() : null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async getByPhone(phone: string, includeInactive = false, tx?: any): Promise<Customer | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = includeInactive
      ? eq(customers.phone, phone)
      : and(eq(customers.phone, phone), eq(customers.is_active, 1));
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(customers)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      last_visit: r.last_visit ? r.last_visit.toISOString() : null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async create(customer: CreateCustomerDTO, tx?: any): Promise<Customer> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [created] = await client
      .insert(customers)
      .values({
        store_id: storeId,
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
        address: customer.address ?? null,
        notes: customer.notes ?? null,
        total_orders: customer.total_orders ?? 0,
        lifetime_value: customer.lifetime_value ?? 0,
        last_visit: customer.last_visit ? new Date(customer.last_visit) : null,
        is_active: customer.is_active ?? 1,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to retrieve created customer");
    }
    return {
      ...created,
      last_visit: created.last_visit ? created.last_visit.toISOString() : null,
      created_at: created.created_at.toISOString(),
      updated_at: created.updated_at.toISOString()
    };
  }

  async update(id: number, customer: UpdateCustomerDTO, tx?: any): Promise<Customer | null> {
    const client = tx || db;
    const storeId = getStoreId();

    const updateData: any = {};
    for (const [key, value] of Object.entries(customer)) {
      if (value !== undefined) {
        if (key === "last_visit" && value) {
          updateData.last_visit = new Date(value);
        } else {
          updateData[key] = value;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getById(id, client);
    }

    updateData.updated_at = new Date();

    let cond = eq(customers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const [updated] = await client
      .update(customers)
      .set(updateData)
      .where(cond)
      .returning();

    if (!updated) return null;

    return {
      ...updated,
      last_visit: updated.last_visit ? updated.last_visit.toISOString() : null,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString()
    };
  }

  async delete(id: number, tx?: any): Promise<boolean> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(customers.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const [updated] = await client
      .update(customers)
      .set({
        is_active: 0,
        updated_at: new Date(),
      })
      .where(cond)
      .returning();

    return !!updated;
  }

  async search(query: string, tx?: any): Promise<Customer[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const likeQuery = `%${query}%`;

    let cond = and(
      eq(customers.is_active, 1),
      or(
        like(customers.name, likeQuery),
        like(customers.phone, likeQuery),
        like(sales.invoice_number, likeQuery)
      )
    );
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        notes: customers.notes,
        total_orders: customers.total_orders,
        lifetime_value: customers.lifetime_value,
        last_visit: customers.last_visit,
        is_active: customers.is_active,
        created_at: customers.created_at,
        updated_at: customers.updated_at,
      })
      .from(customers)
      .leftJoin(sales, eq(sales.customer_id, customers.id))
      .where(cond)
      .orderBy(desc(customers.id));

    // Deduplicate in JS since leftJoin might have multiple rows per customer
    const seen = new Set<number>();
    const uniqueCustomers: Customer[] = [];
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        uniqueCustomers.push({
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email,
          address: r.address,
          notes: r.notes,
          total_orders: r.total_orders,
          lifetime_value: r.lifetime_value,
          last_visit: r.last_visit ? r.last_visit.toISOString() : null,
          is_active: r.is_active,
          created_at: r.created_at.toISOString(),
          updated_at: r.updated_at.toISOString()
        });
      }
    }
    return uniqueCustomers;
  }

  async getCustomerInvoices(customerId: number, tx?: any): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(sales.customer_id, customerId);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(sales)
      .where(cond)
      .orderBy(desc(sales.id));
    return rows;
  }

  async getCustomersExport(tx?: any): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = eq(customers.is_active, 1);
    if (storeId !== undefined) {
      cond = and(cond, eq(customers.store_id, storeId)) as any;
    }

    const rows = await client
      .select()
      .from(customers)
      .where(cond);

    return rows.map((r: any) => ({
      ID: r.id,
      Name: r.name,
      Phone: r.phone,
      Email: r.email,
      Address: r.address,
      TotalOrders: r.total_orders,
      LifetimeValue_INR: r.lifetime_value / 100.0,
      LastVisit: r.last_visit ? r.last_visit.toISOString() : null,
      CreatedAt: r.created_at ? r.created_at.toISOString() : "",
    }));
  }
}
