import db from "../database/db";
import { Customer, CreateCustomerDTO, UpdateCustomerDTO } from "../types/customer.types";

export class CustomerRepository {
  getAll(): Customer[] {
    const stmt = db.prepare("SELECT * FROM customers WHERE is_active = 1 ORDER BY id DESC");
    return stmt.all() as Customer[];
  }

  getById(id: number): Customer | null {
    const stmt = db.prepare("SELECT * FROM customers WHERE id = ?");
    const result = stmt.get(id);
    return (result as Customer) || null;
  }

  getByPhone(phone: string, includeInactive = false): Customer | null {
    const stmt = db.prepare(
      includeInactive
        ? "SELECT * FROM customers WHERE phone = ?"
        : "SELECT * FROM customers WHERE phone = ? AND is_active = 1"
    );
    const result = stmt.get(phone);
    return (result as Customer) || null;
  }

  create(customer: CreateCustomerDTO): Customer {
    const stmt = db.prepare(`
      INSERT INTO customers (
        name, phone, email, address, notes, total_orders, lifetime_value, last_visit
      ) VALUES (
        @name, @phone, @email, @address, @notes, @total_orders, @lifetime_value, @last_visit
      )
    `);

    const result = stmt.run({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? null,
      address: customer.address ?? null,
      notes: customer.notes ?? null,
      total_orders: customer.total_orders ?? 0,
      lifetime_value: customer.lifetime_value ?? 0,
      last_visit: customer.last_visit ?? null,
    });

    const newId = Number(result.lastInsertRowid);
    const createdCustomer = this.getById(newId);
    if (!createdCustomer) {
      throw new Error("Failed to retrieve created customer");
    }
    return createdCustomer;
  }

  update(id: number, customer: UpdateCustomerDTO): Customer | null {
    const fields = (Object.keys(customer) as Array<keyof UpdateCustomerDTO>).filter(
      (key) => customer[key] !== undefined
    );

    if (fields.length === 0) {
      return this.getById(id);
    }

    const setClauses = fields.map((field) => `${field} = @${field}`);
    setClauses.push("updated_at = CURRENT_TIMESTAMP");

    const query = `UPDATE customers SET ${setClauses.join(", ")} WHERE id = @id`;
    const stmt = db.prepare(query);

    const params: any = { id };
    for (const field of fields) {
      params[field] = customer[field] ?? null;
    }

    const result = stmt.run(params);
    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  delete(id: number): boolean {
    const stmt = db.prepare("UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  search(query: string): Customer[] {
    const likeQuery = `%${query}%`;
    const stmt = db.prepare(`
      SELECT DISTINCT c.* 
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      WHERE c.is_active = 1 
        AND (c.name LIKE ? OR c.phone LIKE ? OR s.invoice_number LIKE ?)
      ORDER BY c.id DESC
    `);
    return stmt.all(likeQuery, likeQuery, likeQuery) as Customer[];
  }

  getCustomerInvoices(customerId: number): any[] {
    const stmt = db.prepare(`
      SELECT * FROM sales
      WHERE customer_id = ?
      ORDER BY id DESC
    `);
    return stmt.all(customerId);
  }
}
