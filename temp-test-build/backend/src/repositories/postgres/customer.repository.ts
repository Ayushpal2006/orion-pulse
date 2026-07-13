import { ICustomerRepository } from "../interfaces/ICustomerRepository";
import { Customer, CreateCustomerDTO, UpdateCustomerDTO } from "../../types/customer.types";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class PostgresCustomerRepository implements ICustomerRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async getAll(tx?: DatabaseAdapter): Promise<Customer[]> {
    const client = tx || this.db;
    return client.query<Customer>("SELECT * FROM customers WHERE is_active = 1 ORDER BY id DESC");
  }

  async getById(id: number, tx?: DatabaseAdapter): Promise<Customer | null> {
    const client = tx || this.db;
    return client.queryOne<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
  }

  async getByPhone(phone: string, includeInactive = false, tx?: DatabaseAdapter): Promise<Customer | null> {
    const client = tx || this.db;
    const query = includeInactive
      ? "SELECT * FROM customers WHERE phone = ?"
      : "SELECT * FROM customers WHERE phone = ? AND is_active = 1";
    return client.queryOne<Customer>(query, [phone]);
  }

  async create(customer: CreateCustomerDTO, tx?: DatabaseAdapter): Promise<Customer> {
    const client = tx || this.db;
    const result = await client.execute(`
      INSERT INTO customers (
        name, phone, email, address, notes, total_orders, lifetime_value, last_visit
      ) VALUES (
        @name, @phone, @email, @address, @notes, @total_orders, @lifetime_value, @last_visit
      )
    `, {
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? null,
      address: customer.address ?? null,
      notes: customer.notes ?? null,
      total_orders: customer.total_orders ?? 0,
      lifetime_value: customer.lifetime_value ?? 0,
      last_visit: customer.last_visit ?? null,
    });

    const newId = Number(result.lastInsertId);
    const createdCustomer = await this.getById(newId, client);
    if (!createdCustomer) {
      throw new Error("Failed to retrieve created customer");
    }
    return createdCustomer;
  }

  async update(id: number, customer: UpdateCustomerDTO, tx?: DatabaseAdapter): Promise<Customer | null> {
    const client = tx || this.db;
    const fields = (Object.keys(customer) as Array<keyof UpdateCustomerDTO>).filter(
      (key) => customer[key] !== undefined
    );

    if (fields.length === 0) {
      return this.getById(id, client);
    }

    const setClauses = fields.map((field) => `${field} = @${field}`);
    setClauses.push("updated_at = CURRENT_TIMESTAMP");

    const query = `UPDATE customers SET ${setClauses.join(", ")} WHERE id = @id`;
    const params: any = { id };
    for (const field of fields) {
      params[field] = customer[field] ?? null;
    }

    const result = await client.execute(query, params);
    if (result.changes === 0) {
      return null;
    }

    return this.getById(id, client);
  }

  async delete(id: number, tx?: DatabaseAdapter): Promise<boolean> {
    const client = tx || this.db;
    const result = await client.execute("UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    return result.changes > 0;
  }

  async search(query: string, tx?: DatabaseAdapter): Promise<Customer[]> {
    const client = tx || this.db;
    const likeQuery = `%${query}%`;
    return client.query<Customer>(`
      SELECT DISTINCT c.* 
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      WHERE c.is_active = 1 
        AND (c.name LIKE ? OR c.phone LIKE ? OR s.invoice_number LIKE ?)
      ORDER BY c.id DESC
    `, [likeQuery, likeQuery, likeQuery]);
  }

  async getCustomerInvoices(customerId: number, tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    return client.query(`
      SELECT * FROM sales
      WHERE customer_id = ?
      ORDER BY id DESC
    `, [customerId]);
  }

  async getCustomersExport(tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    return client.query(`
      SELECT id as ID, 
             name as Name, 
             phone as Phone, 
             email as Email, 
             address as Address, 
             total_orders as TotalOrders, 
             lifetime_value/100.0 as LifetimeValue_INR, 
             last_visit as LastVisit, 
             created_at as CreatedAt 
      FROM customers 
      WHERE is_active = 1
    `);
  }
}
